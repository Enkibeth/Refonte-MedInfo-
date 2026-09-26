/**
 * Diagnostic des clés Supabase au démarrage — sans JAMAIS écrire une clé.
 *
 * Constaté pendant la recette Hostinger (2026-09) : `/api/health` ne vérifie que la
 * PRÉSENCE des variables. Des clés présentes mais inutilisables — valeurs entièrement en
 * majuscules, texte masqué « •••• » copié depuis le tableau de bord, espace en fin de
 * valeur — passaient inaperçues ; seuls les appels réels échouaient (« Invalid API key »),
 * et la réponse du chat n'était plus archivée.
 *
 * Ce module décrit la FORME d'une clé (format, longueur, blancs, caractères non ASCII,
 * rôle et projet d'un JWT — des métadonnées, jamais la signature) et demande à Supabase
 * s'il l'accepte. Le journal d'exécution dit alors, dès le premier démarrage, ce qui ne va
 * pas. Aucune valeur de clé, ni aucun fragment de sa partie secrète, n'est jamais écrit.
 */

const JWT_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

function decodeJwtPayload(token) {
  try {
    const part = token.split('.')[1];
    const json = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const payload = JSON.parse(json);
    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    return null;
  }
}

/**
 * @typedef {{
 *   present: boolean,
 *   length?: number,
 *   edgeWhitespace?: boolean,
 *   innerWhitespace?: boolean,
 *   nonAscii?: boolean,
 *   quoted?: boolean,
 *   upperCased?: boolean,
 *   format?: string,
 *   role?: string,
 *   ref?: string,
 * }} KeyShape
 */

/**
 * Décrit la forme d'une clé, sans la recopier.
 * @param {unknown} raw
 * @returns {KeyShape}
 */
export function describeKey(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return { present: false };
  const trimmed = raw.trim();
  /** @type {KeyShape} */
  const desc = {
    present: true,
    length: trimmed.length,
    edgeWhitespace: trimmed.length !== raw.length,
    innerWhitespace: /\s/.test(trimmed),
    nonAscii: /[^\x20-\x7E]/.test(trimmed),
    quoted: /^["'].*["']$/.test(trimmed),
    upperCased: /[A-Z]/.test(trimmed) && !/[a-z]/.test(trimmed),
    format: 'inconnu',
    role: undefined,
    ref: undefined,
  };
  if (trimmed.startsWith('sb_secret_')) desc.format = 'sb_secret';
  else if (trimmed.startsWith('sb_publishable_')) desc.format = 'sb_publishable';
  else if (JWT_RE.test(trimmed)) {
    const payload = decodeJwtPayload(trimmed);
    if (payload) {
      desc.format = 'jwt';
      if (typeof payload.role === 'string') desc.role = payload.role;
      if (typeof payload.ref === 'string') desc.ref = payload.ref;
    } else {
      desc.format = 'jwt illisible';
    }
  }
  return desc;
}

/** Identifiant du projet (`<ref>.supabase.co`) tiré de l'URL, ou `undefined`. */
export function expectedProjectRef(url) {
  try {
    const host = new URL(String(url).trim()).hostname;
    return host.endsWith('.supabase.co') ? host.split('.')[0] : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Résumé lisible de la forme d'une clé — ne contient jamais la clé.
 * @param {KeyShape} desc
 * @param {string | undefined} expectedRef
 */
export function describeKeyShape(desc, expectedRef) {
  if (!desc.present) return 'absente';
  const parts = [`format ${desc.format}`, `${desc.length} car.`];
  if (desc.role) parts.push(`rôle ${desc.role}`);
  if (desc.ref) {
    parts.push(!expectedRef || desc.ref === expectedRef ? `projet ${desc.ref}` : `AUTRE projet (${desc.ref})`);
  }
  if (desc.edgeWhitespace) parts.push('espace ou retour à la ligne au bord de la valeur');
  if (desc.innerWhitespace) parts.push("espace à l'intérieur de la valeur");
  if (desc.nonAscii) parts.push('caractères non ASCII (texte masqué « •••• » copié ?)');
  if (desc.quoted) parts.push('entourée de guillemets');
  if (desc.upperCased) parts.push('entièrement en MAJUSCULES');
  return parts.join(', ');
}

async function probe(fetchImpl, url, key, timeoutMs, { bearer = false } = {}) {
  try {
    // `bearer` : mêmes en-têtes que supabase-js (apikey + Authorization). Constaté : avec une
    // clé service_role JWT envoyée en `apikey` SEUL, Supabase répond 200 mais en rôle anon
    // (aucune ligne) — le test aurait conclu à tort « sans droits ».
    const headers = bearer ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key };
    const res = await fetchImpl(url, {
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { status: res.status, body };
  } catch (error) {
    return { status: 0, error: error instanceof Error ? error.name : 'erreur' };
  }
}

function supabaseMessage(body) {
  const msg = body && typeof body === 'object' && !Array.isArray(body) ? body.message ?? body.msg : undefined;
  return typeof msg === 'string' ? msg.slice(0, 80) : undefined;
}

/**
 * Vérifie les clés Supabase du processus auprès de Supabase et renvoie les lignes de
 * journal à écrire. Ne lance jamais ; ne renvoie rien si aucune URL Supabase n'est posée.
 * @param {Record<string, string | undefined>} env
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number }} [options]
 * @returns {Promise<Array<{ level: 'log' | 'warn' | 'error', text: string }>>}
 */
export async function checkSupabaseKeys(env, options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 5_000;
  const rawUrl = (env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
  let base;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return [];
    base = parsed.origin;
  } catch {
    return [];
  }
  const expectedRef = expectedProjectRef(base);
  const lines = [];

  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const serviceDesc = describeKey(serviceKey);
  const serviceShape = describeKeyShape(serviceDesc, expectedRef);
  if (!serviceDesc.present) {
    lines.push({ level: 'warn', text: '[medinfo] supabase : clé service_role absente' });
  } else {
    // Lecture minimale d'une table sans policy client : seule une clé service_role y voit
    // des lignes (une clé anon/publishable reçoit un tableau vide, une clé invalide un 401).
    const r = await probe(fetchImpl, `${base}/rest/v1/ai_model_config?select=key&limit=1`, serviceKey, timeoutMs, {
      bearer: true,
    });
    if (r.status === 200 && Array.isArray(r.body) && r.body.length > 0) {
      lines.push({ level: 'log', text: `[medinfo] supabase : clé service_role acceptée, droits confirmés — ${serviceShape}` });
    } else if (r.status === 200) {
      lines.push({
        level: 'error',
        text: `[medinfo] supabase : clé service_role acceptée mais SANS droits service_role (clé anon/publishable ?) — ${serviceShape}`,
      });
    } else if (r.status === 0) {
      // Un caractère non ASCII (« • » d'un texte masqué, retour à la ligne) est interdit dans
      // un en-tête HTTP : la requête ne part même pas — l'application échoue de la même façon.
      lines.push(
        serviceDesc.nonAscii
          ? { level: 'error', text: `[medinfo] supabase : clé service_role INUTILISABLE (caractères interdits dans un en-tête HTTP) — ${serviceShape}` }
          : { level: 'warn', text: `[medinfo] supabase : vérification de la clé service_role impossible (${r.error}) — ${serviceShape}` },
      );
    } else {
      const msg = supabaseMessage(r.body);
      lines.push({
        level: 'error',
        text: `[medinfo] supabase : clé service_role REFUSÉE (HTTP ${r.status}${msg ? ` « ${msg} »` : ''}) — ${serviceShape}`,
      });
    }
  }

  const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const anonDesc = describeKey(anonKey);
  if (anonDesc.present) {
    const anonShape = describeKeyShape(anonDesc, expectedRef);
    const r = await probe(fetchImpl, `${base}/auth/v1/settings`, anonKey, timeoutMs);
    if (r.status === 200) {
      lines.push({ level: 'log', text: `[medinfo] supabase : clé publique acceptée — ${anonShape}` });
    } else if (r.status === 0) {
      lines.push(
        anonDesc.nonAscii
          ? { level: 'error', text: `[medinfo] supabase : clé publique INUTILISABLE (caractères interdits dans un en-tête HTTP) — ${anonShape}` }
          : { level: 'warn', text: `[medinfo] supabase : vérification de la clé publique impossible (${r.error}) — ${anonShape}` },
      );
    } else {
      const msg = supabaseMessage(r.body);
      lines.push({
        level: 'error',
        text: `[medinfo] supabase : clé publique REFUSÉE (HTTP ${r.status}${msg ? ` « ${msg} »` : ''}) — ${anonShape}`,
      });
    }
  }
  return lines;
}
