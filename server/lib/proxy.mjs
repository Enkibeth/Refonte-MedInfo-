/**
 * Lecture des en-têtes de reverse proxy (Hostinger place systématiquement l'application
 * Node derrière LiteSpeed/nginx, qui termine le TLS et relaie en HTTP clair).
 *
 * Enjeu concret : l'adaptateur `expo-server/adapter/http` déduit le schéma d'URL de
 * `req.socket.encrypted`. Derrière un proxy, cette valeur est FAUSSE (connexion interne en
 * clair) et toutes les routes qui construisent une URL absolue à partir de la requête —
 * `success_url`/`cancel_url` Stripe en tête — se retrouveraient en `http://`. Ce module
 * fournit la lecture PURE des en-têtes `X-Forwarded-*` ; `server/index.mjs` s'en sert pour
 * réaligner la requête avant de la passer à l'adaptateur.
 *
 * `trustProxy` est explicite : ces en-têtes sont falsifiables par le client si l'application
 * est exposée en direct. Testé dans `tests/unit/hostinger-static.test.ts`.
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
