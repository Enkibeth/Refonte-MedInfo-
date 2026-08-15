/**
 * Politique de service des fichiers statiques du serveur Node autonome (Hostinger).
 *
 * Sur Vercel, `dist/client` était servi par la plateforme (CDN + en-têtes de `vercel.json`)
 * et la fonction ne voyait que les routes HTML/API. En Node autonome, l'application sert
 * elle-même ses assets : ce module contient la logique PURE (aucune I/O, aucun `http`)
 * de cette responsabilité — résolution de chemin, en-têtes de cache, négociation
 * d'encodage, ETag. Testé dans `tests/unit/hostinger-static.test.ts`.
 *
 * Les durées de cache reproduisent `vercel.json` :
 *   - `/_expo/static/*` : bundles au nom haché → immuables 1 an ;
 *   - `/assets/*` : assets Expo → 1 jour + revalidation en arrière-plan ;
 *   - tout le reste : `no-store` (coquilles HTML, pages autonomes, robots.txt…).
 * Ajout propre à l'auto-hébergement : `/vendor/*` (librairies des pages autonomes —
 * pdf.js, SheetJS, jsPDF… — plusieurs Mo, jamais modifiées hors mise à jour du dépôt)
 * suit la politique `/assets/*`, sinon chaque ouverture de page les retélécharge
 * intégralement sans CDN devant.
 */
import path from 'node:path';

export const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';
export const ASSET_CACHE_CONTROL = 'public, max-age=86400, stale-while-revalidate=604800';
export const NO_STORE_CACHE_CONTROL = 'no-store';

/** Préfixes d'URL dont le contenu est immuable (nom de fichier haché par Metro). */
export const IMMUTABLE_PREFIXES = ['/_expo/static/'];
/** Préfixes d'URL versionnés par le dépôt (rafraîchis à chaque déploiement). */
export const ASSET_PREFIXES = ['/assets/', '/vendor/'];

/**
 * En-tête `Cache-Control` d'un chemin statique.
 * @param {string} pathname chemin d'URL décodé, commençant par `/`
 * @returns {string}
 */
export function cacheControlFor(pathname) {
  if (IMMUTABLE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return IMMUTABLE_CACHE_CONTROL;
  }
  if (ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return ASSET_CACHE_CONTROL;
  }
  return NO_STORE_CACHE_CONTROL;
}

/** Types MIME servis (l'export web n'en produit pas d'autres). */
const MIME_TYPES = Object.freeze({
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.otf': 'font/otf',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
});

/**
 * Type MIME d'un fichier ; `application/octet-stream` si l'extension est inconnue.
 * @param {string} filePath
 * @returns {string}
 */
export function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] ?? 'application/octet-stream';
}

/** Extensions pour lesquelles une variante précompressée est cherchée. */
const COMPRESSIBLE_EXTENSIONS = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.map',
  '.mjs',
  '.svg',
  '.txt',
  '.webmanifest',
  '.xml',
]);

/**
 * Le contenu gagne-t-il à être servi précompressé ? (images/fontes woff2 déjà compressées)
 * @param {string} filePath
 * @returns {boolean}
 */
export function isCompressible(filePath) {
  return COMPRESSIBLE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

/**
 * Résout un chemin d'URL vers un fichier de `root`, ou `null` si la requête ne doit pas
 * être servie statiquement.
 *
 * Refuse : les chemins hors de `root` (traversée `..`, encodée ou non), les octets nuls,
 * les URL mal encodées, les répertoires (pas d'`index.html` implicite) et tout ce qui n'a
 * pas d'extension de fichier — ces routes appartiennent au moteur de rendu Expo, qui reste
 * la source de vérité pour le HTML. `/api/*` est exclu sans condition : une route API ne
 * doit jamais pouvoir être masquée par un fichier déposé dans `dist/client`.
 *
 * @param {string} root répertoire absolu de `dist/client`
 * @param {string} pathname chemin d'URL BRUT (encodé), commençant par `/`
 * @returns {string | null} chemin absolu candidat (existence non vérifiée)
 */
export function resolveStaticPath(root, pathname) {
  if (typeof pathname !== 'string' || !pathname.startsWith('/')) return null;
  if (pathname.startsWith('/api/') || pathname === '/api') return null;

  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null; // Séquence `%` invalide → jamais servi.
  }

  if (decoded.includes('\0')) return null;
  if (decoded.endsWith('/')) return null;
  if (path.extname(decoded) === '') return null;

  const normalized = path.posix.normalize(decoded);
  if (normalized.startsWith('../') || normalized === '..') return null;

  const absolute = path.resolve(root, `.${normalized}`);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (!absolute.startsWith(rootWithSep)) return null;

  return absolute;
}

/**
 * Négocie l'encodage de contenu à partir d'`Accept-Encoding` et des variantes disponibles.
 *
 * @param {string | string[] | undefined} acceptEncoding
 * @param {{ br?: boolean; gzip?: boolean }} [available]
 * @returns {{ encoding: 'br' | 'gzip' | null; suffix: '.br' | '.gz' | '' }}
 */
export function pickEncoding(acceptEncoding, available = {}) {
  const header = Array.isArray(acceptEncoding) ? acceptEncoding.join(',') : (acceptEncoding ?? '');
  const accepted = new Map();
  for (const part of String(header).split(',')) {
    const [rawName, ...params] = part.split(';');
    const name = rawName.trim().toLowerCase();
    if (!name) continue;
    let q = 1;
    for (const param of params) {
      const [k, v] = param.split('=');
      if (k?.trim().toLowerCase() === 'q') q = Number.parseFloat(v ?? '') || 0;
    }
    accepted.set(name, q);
  }

  const allows = (name) => {
    const q = accepted.get(name) ?? accepted.get('*');
    return typeof q === 'number' && q > 0;
  };

  if (available.br && allows('br')) return { encoding: 'br', suffix: '.br' };
  if (available.gzip && allows('gzip')) return { encoding: 'gzip', suffix: '.gz' };
  return { encoding: null, suffix: '' };
}

/**
 * ETag faible dérivé de la taille et de la date de modification du fichier ORIGINAL
 * (jamais de la variante compressée : la même entité doit garder le même validateur).
 *
 * @param {{ size: number; mtimeMs: number }} stat
 * @returns {string}
 */
export function etagFor(stat) {
  const size = Math.trunc(stat.size).toString(16);
  const mtime = Math.trunc(stat.mtimeMs).toString(16);
  return `W/"${size}-${mtime}"`;
}

/**
 * La réponse peut-elle être un 304 ? (`If-None-Match` prioritaire sur `If-Modified-Since`,
 * conformément à la RFC 9110 §13.1.3)
 *
 * @param {{ ifNoneMatch?: string | string[]; ifModifiedSince?: string | string[] }} headers
 * @param {{ etag: string; mtimeMs: number }} entity
 * @returns {boolean}
 */
export function isNotModified(headers, entity) {
  const first = (v) => (Array.isArray(v) ? v[0] : v);

  const ifNoneMatch = first(headers.ifNoneMatch);
  if (ifNoneMatch) {
    if (ifNoneMatch.trim() === '*') return true;
    const tags = ifNoneMatch.split(',').map((t) => t.trim());
    // Comparaison faible : `W/"x"` et `"x"` désignent la même entité.
    const strip = (t) => t.replace(/^W\//, '');
    return tags.some((tag) => strip(tag) === strip(entity.etag));
  }

  const ifModifiedSince = first(headers.ifModifiedSince);
  if (ifModifiedSince) {
    const since = Date.parse(ifModifiedSince);
    if (Number.isNaN(since)) return false;
    // `Last-Modified` est tronqué à la seconde : on compare à la même granularité.
    return Math.floor(entity.mtimeMs / 1000) * 1000 <= since;
  }

  return false;
}
