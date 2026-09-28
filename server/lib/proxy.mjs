/**
 * Lecture des en-têtes de reverse proxy (Hostinger place l'application Node derrière son
 * serveur web — LiteSpeed — et, pour un domaine qui l'active, derrière son CDN `hcdn` : le
 * TLS est terminé en amont et la requête arrive en HTTP clair).
 *
 * Enjeu concret : l'adaptateur `expo-server/adapter/http` déduit le schéma d'URL de
 * `req.socket.encrypted`. Derrière un proxy, cette valeur est FAUSSE (connexion interne en
 * clair) et toutes les routes qui construisent une URL absolue à partir de la requête —
 * `success_url`/`cancel_url` Stripe en tête — se retrouveraient en `http://`. Ce module
 * fournit la lecture PURE des en-têtes `X-Forwarded-*` ; `server/index.mjs` s'en sert pour
 * réaligner la requête avant de la passer à l'adaptateur.
 *
 * `trustProxy` est explicite : ces en-têtes sont falsifiables par le client si l'application
 * est exposée en direct. Testé dans `tests/unit/hostinger-server.test.ts`.
 */

/** @param {string | string[] | undefined} value */
function firstValue(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') return undefined;
  // `X-Forwarded-*` peut être une liste « client, proxy1, proxy2 » : le client est en tête.
  const first = raw.split(',')[0]?.trim();
  return first ? first : undefined;
}

/**
 * Protocole et hôte publics d'une requête.
 *
 * @param {Record<string, string | string[] | undefined>} headers en-têtes bruts (minuscules)
 * @param {{ trustProxy?: boolean; encrypted?: boolean }} [options]
 * @returns {{ protocol: 'http' | 'https'; host: string | undefined }}
 */
export function resolveForwarded(headers, options = {}) {
  const { trustProxy = true, encrypted = false } = options;
  const fallbackHost = firstValue(headers?.host);

  if (!trustProxy) {
    return { protocol: encrypted ? 'https' : 'http', host: fallbackHost };
  }

  const proto = firstValue(headers?.['x-forwarded-proto'])?.toLowerCase();
  const forwardedHost = firstValue(headers?.['x-forwarded-host']);

  /** @type {'http' | 'https'} */
  let protocol = encrypted ? 'https' : 'http';
  if (proto === 'https' || proto === 'http') {
    protocol = proto;
  } else if (firstValue(headers?.['x-forwarded-ssl'])?.toLowerCase() === 'on') {
    protocol = 'https';
  }

  return { protocol, host: forwardedHost ?? fallbackHost };
}

/**
 * Nombre de proxys de confiance devant Node (`TRUST_PROXY_HOPS`), borné à [1, 5].
 * Toute valeur absente ou invalide vaut 1 : un seul maillon de confiance, celui qui nous
 * transmet la requête.
 *
 * @param {string | undefined} raw
 * @returns {number}
 */
export function parseTrustedHops(raw) {
  const value = Number.parseInt(String(raw ?? '').trim(), 10);
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.min(value, 5);
}

/**
 * Adresse IP du client, telle que le rate-limit anonyme doit la voir.
 *
 * `X-Forwarded-For` est une liste où chaque proxy AJOUTE à droite l'adresse qui s'est
 * connectée à lui. Seules les entrées de droite, écrites par nos propres proxys, sont
 * fiables : l'entrée de gauche est ce que le client a bien voulu envoyer. La lire (comme on
 * le faisait implicitement en prenant la première valeur) permettait de contourner le quota
 * anonyme de `/api/analyze` en changeant d'en-tête à chaque requête — donc de faire payer des
 * appels LLM illimités. Sur l'ancienne plateforme serverless, elle réécrivait l'en-tête ; ici, c'est à nous.
 *
 * Avec `hops` proxys de confiance, l'adresse du client est la `hops`-ième en partant de la
 * droite. Si la liste est plus courte (ou absente), on retombe sur l'entrée la plus à gauche
 * disponible, puis sur l'adresse de la connexion TCP.
 *
 * @param {Record<string, string | string[] | undefined>} headers
 * @param {{ trustProxy?: boolean; hops?: number; remoteAddress?: string }} [options]
 * @returns {string | undefined}
 */
export function resolveClientIp(headers, options = {}) {
  const { trustProxy = true, hops = 1, remoteAddress } = options;
  const socketAddress = normalizeIp(remoteAddress);
  if (!trustProxy) return socketAddress;

  const raw = headers?.['x-forwarded-for'];
  const joined = Array.isArray(raw) ? raw.join(',') : raw;
  const chain =
    typeof joined === 'string'
      ? joined
          .split(',')
          .map((entry) => normalizeIp(entry))
          .filter((entry) => typeof entry === 'string')
      : [];

  if (chain.length === 0) {
    // Pas de liste : certains proxys ne posent que `X-Real-IP` (qu'ils écrasent).
    return normalizeIp(firstValue(headers?.['x-real-ip'])) ?? socketAddress;
  }
  const index = Math.max(chain.length - Math.max(1, hops), 0);
  return chain[index];
}

/**
 * Retire les décorations fréquentes d'une adresse (`::ffff:` IPv4 mappée, crochets IPv6,
 * port) et rejette ce qui n'est manifestement pas une adresse.
 *
 * @param {string | undefined} value
 * @returns {string | undefined}
 */
function normalizeIp(value) {
  if (typeof value !== 'string') return undefined;
  let ip = value.trim();
  if (!ip) return undefined;
  // `[2001:db8::1]:443` → `2001:db8::1`
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(ip);
  if (bracketed) ip = bracketed[1];
  // `203.0.113.7:51234` → `203.0.113.7` (un seul `:` ⇒ IPv4 + port)
  else if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(ip)) ip = ip.slice(0, ip.lastIndexOf(':'));
  if (ip.toLowerCase().startsWith('::ffff:') && ip.includes('.')) ip = ip.slice(7);
  // Garde-fou : uniquement des caractères d'adresse IPv4/IPv6 (jamais d'espace, de virgule…).
  if (!/^[0-9a-fA-F:.]{2,45}$/.test(ip)) return undefined;
  return ip;
}

/**
 * Remplace (ou ajoute) un en-tête dans `rawHeaders` — le tableau `[nom, valeur, …]` d'où
 * l'adaptateur Expo reconstruit les en-têtes de la `Request` vue par les routes API.
 * Modifier `req.headers` seul n'y changerait RIEN : l'adaptateur ne le lit pas.
 *
 * @param {string[]} rawHeaders
 * @param {string} name nom en minuscules
 * @param {string} value
 * @returns {string[]} nouveau tableau (l'original n'est pas modifié)
 */
export function withRawHeader(rawHeaders, name, value) {
  /** @type {string[]} */
  const out = [];
  for (let i = 0; i + 1 < rawHeaders.length; i += 2) {
    if (String(rawHeaders[i]).toLowerCase() === name) continue;
    out.push(rawHeaders[i], rawHeaders[i + 1]);
  }
  out.push(name, value);
  return out;
}

/** En-têtes d'adresse client lus par le rate-limit (src/ai/rateLimit/chatRateLimit.ts). */
export const CLIENT_IP_HEADERS = ['x-forwarded-for', 'x-real-ip', 'cf-connecting-ip'];

/**
 * Retire des en-têtes de `rawHeaders` (noms en minuscules). Sert quand aucune adresse
 * fiable n'est connue : mieux vaut un compteur commun que lire une IP fournie par le client.
 *
 * @param {string[]} rawHeaders
 * @param {string[]} names
 * @returns {string[]}
 */
export function withoutRawHeaders(rawHeaders, names) {
  /** @type {string[]} */
  const out = [];
  for (let i = 0; i + 1 < rawHeaders.length; i += 2) {
    if (names.includes(String(rawHeaders[i]).toLowerCase())) continue;
    out.push(rawHeaders[i], rawHeaders[i + 1]);
  }
  return out;
}

/**
 * Hôte canonique du site, sans port, en minuscules — dérivé de `CANONICAL_HOST` ou, à
 * défaut, de `EXPO_PUBLIC_APP_URL`. `undefined` si rien d'exploitable n'est configuré.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {string | undefined}
 */
export function canonicalHostFrom(env) {
  const explicit = env?.CANONICAL_HOST?.trim().toLowerCase();
  if (explicit) return explicit.replace(/:\d+$/, '') || undefined;
  const appUrl = env?.EXPO_PUBLIC_APP_URL?.trim();
  if (!appUrl) return undefined;
  try {
    const { hostname } = new URL(appUrl);
    return hostname ? hostname.toLowerCase() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * URL de redirection vers le domaine canonique, ou `null`.
 *
 * Ne redirige QUE la variante `www.` ↔ apex du domaine canonique : jamais un autre hôte.
 * C'est volontaire — pendant la recette, l'application tourne sur le domaine temporaire de
 * Hostinger alors que `EXPO_PUBLIC_APP_URL` vise déjà le vrai domaine ; une redirection
 * générique « tout hôte ≠ canonique » enverrait les testeurs vers l'ancien site.
 *
 * @param {{ host: string | undefined; url: string | undefined; canonicalHost: string | undefined }} params
 * @returns {string | null}
 */
export function canonicalRedirect({ host, url, canonicalHost }) {
  if (!host || !canonicalHost) return null;
  const requestHost = host.trim().toLowerCase().replace(/:\d+$/, '');
  if (!requestHost || requestHost === canonicalHost) return null;

  const isAlias =
    requestHost === `www.${canonicalHost}` ||
    (canonicalHost.startsWith('www.') && requestHost === canonicalHost.slice(4));
  if (!isAlias) return null;

  const path = typeof url === 'string' && url.startsWith('/') ? url : '/';
  return `https://${canonicalHost}${path}`;
}

/**
 * Où écouter : port TCP (cas nominal, `PORT` attribué par l'hébergeur) ou chemin de socket
 * (certains gestionnaires d'applications passent un socket Unix dans `PORT`).
 *
 * Sans `HOST`, on écoute sur TOUTES les interfaces, IPv4 ET IPv6 (comportement par défaut
 * de Node, celui de l'exemple Express de Hostinger). Forcer `0.0.0.0` n'écoutait qu'en IPv4 :
 * un proxy local qui résout `localhost` en `::1` ne pouvait plus joindre l'application.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {{ port: number; host?: string } | { path: string }}
 */
export function resolveListenTarget(env) {
  const rawPort = env?.PORT?.trim();
  const host = env?.HOST?.trim() || undefined;

  if (rawPort && !/^\d+$/.test(rawPort)) return { path: rawPort };

  const parsed = rawPort ? Number.parseInt(rawPort, 10) : 3000;
  const port = parsed >= 0 && parsed < 65536 ? parsed : 3000;
  return host ? { port, host } : { port };
}
