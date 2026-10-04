/**
 * Service des coquilles HTML pré-rendues par Expo (`dist/server/**.html`).
 *
 * Expo sert déjà ces fichiers, mais tels quels : sans compression (85 Ko pour l'accueil,
 * relevé par Lighthouse 2026-10), sans `charset` dans `Content-Type` (la balise `<meta
 * charset>` arrive après les balises SEO, hors des 1 024 premiers octets) et sans CSP. Ce
 * module reprend la même résolution — le manifeste `_expo/routes.json` produit par Expo, dans
 * le même ordre (pages, puis routes API, puis page 404) — et sert le fichier compressé
 * (Brotli/gzip, calculé une fois puis gardé en mémoire), avec sa CSP à empreintes.
 *
 * Repli intégral sur le moteur Expo (`handle()` renvoie toujours `false`) dès que le
 * manifeste utilise une fonction qu'on ne reproduit pas : rendu serveur (SSR), middleware,
 * redirections/réécritures, `loader` de page. Ainsi une évolution de l'application vers ces
 * fonctions ne peut pas être court-circuitée en silence.
 *
 * Les parties pures (`analyzeManifest`, `matchHtmlRoute`) sont testées dans
 * `tests/unit/server-security.test.ts` ; la fumigation `npm run smoke:node` couvre le reste.
 */
import fsp from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { promisify } from 'node:util';

import { NO_STORE_CACHE_CONTROL, pickEncoding } from './static.mjs';

const brotli = promisify(zlib.brotliCompress);
const gzip = promisify(zlib.gzip);

/**
 * Le manifeste est-il entièrement servable par ce module ?
 * @param {any} manifest contenu de `_expo/routes.json`
 * @returns {{ supported: true; htmlRoutes: { page: string; regex: RegExp }[]; apiRoutes: RegExp[]; notFoundRoutes: { page: string; regex: RegExp }[] } | { supported: false; reason: string }}
 */
export function analyzeManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') return { supported: false, reason: 'manifeste absent' };
  if (manifest.rendering) return { supported: false, reason: 'rendu serveur (SSR)' };
  if (manifest.middleware) return { supported: false, reason: 'middleware' };
  if (Array.isArray(manifest.redirects) && manifest.redirects.length > 0) return { supported: false, reason: 'redirections' };
  if (Array.isArray(manifest.rewrites) && manifest.rewrites.length > 0) return { supported: false, reason: 'réécritures' };
  if (manifest.headers && Object.keys(manifest.headers).length > 0) return { supported: false, reason: 'en-têtes déclarés' };
  const html = Array.isArray(manifest.htmlRoutes) ? manifest.htmlRoutes : [];
  if (html.some((route) => route.loader)) return { supported: false, reason: 'loader de page' };
  try {
    return {
      supported: true,
      htmlRoutes: html.map((route) => ({ page: route.page, regex: new RegExp(route.namedRegex) })),
      apiRoutes: (manifest.apiRoutes ?? []).map((route) => new RegExp(route.namedRegex)),
      notFoundRoutes: (manifest.notFoundRoutes ?? []).map((route) => ({
        page: route.page,
        regex: new RegExp(route.namedRegex),
      })),
    };
  } catch {
    return { supported: false, reason: 'expression de route illisible' };
  }
}

/**
 * Résout un chemin vers la page à servir, dans l'ordre du moteur Expo.
 * @param {Exclude<ReturnType<typeof analyzeManifest>, { supported: false }>} routes
 * @param {string} pathname chemin d'URL (sans query)
 * @returns {{ kind: 'page'; page: string; status: 200 | 404 } | { kind: 'api' } | null}
 */
export function matchHtmlRoute(routes, pathname) {
  for (const route of routes.htmlRoutes) {
    if (route.regex.test(pathname)) return { kind: 'page', page: route.page, status: 200 };
  }
  if (routes.apiRoutes.some((regex) => regex.test(pathname))) return { kind: 'api' };
  for (const route of routes.notFoundRoutes) {
    if (route.regex.test(pathname)) return { kind: 'page', page: route.page, status: 404 };
  }
  return null;
}

/**
 * Fichier HTML d'une page, avec le même repli « index hissé » qu'Expo
 * (`/blog/index` → `blog.html`).
 * @param {string} buildDir
 * @param {string} page
 */
async function readPage(buildDir, page) {
  const candidates = [`${page}.html`];
  if (page.endsWith('/index') && page.length > '/index'.length) candidates.push(`${page.slice(0, -'/index'.length)}.html`);
  for (const candidate of candidates) {
    const file = path.join(buildDir, `.${candidate}`);
    if (!file.startsWith(buildDir + path.sep)) continue;
    try {
      return await fsp.readFile(file);
    } catch {
      /* candidat suivant */
    }
  }
  return null;
}

/**
 * @param {{
 *   buildDir: string;
 *   headersFor: (html: string) => Record<string, string>;
 *   onUnsupported?: (reason: string) => void;
 *   enrich?: (request: { page: string; pathname: string; html: string }) => Promise<{ html: string; status: number } | null>;
 * }} params
 * `enrich` : document propre à l'URL (ex. métadonnées d'un article de blog, server/lib/blog-prerender.mjs),
 * compressé à la volée ; `null` → coquille pré-rendue servie telle quelle.
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => Promise<boolean>}
 */
export function createHtmlHandler({ buildDir, headersFor, onUnsupported, enrich }) {
  /** @type {Promise<ReturnType<typeof analyzeManifest>> | null} */
  let routesPromise = null;
  /** @type {Map<string, Promise<{ raw: Buffer; text: string; br: Buffer; gzip: Buffer; headers: Record<string, string> } | null>>} */
  const pages = new Map();

  function loadRoutes() {
    routesPromise ??= fsp
      .readFile(path.join(buildDir, '_expo', 'routes.json'), 'utf8')
      .then((text) => analyzeManifest(JSON.parse(text)))
      .catch(() => analyzeManifest(null))
      .then((routes) => {
        if (!routes.supported) onUnsupported?.(routes.reason);
        return routes;
      });
    return routesPromise;
  }

  function loadPage(page) {
    let entry = pages.get(page);
    if (!entry) {
      entry = readPage(buildDir, page)
        .then(async (raw) => {
          if (!raw) return null;
          const [br, gz] = await Promise.all([
            brotli(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }),
            gzip(raw, { level: 9 }),
          ]);
          const text = raw.toString('utf8');
          return { raw, text, br, gzip: gz, headers: headersFor(text) };
        })
        .catch((error) => {
          // Jamais d'échec mis en cache : la requête suivante réessaie ; celle-ci part chez Expo.
          pages.delete(page);
          console.error(`[medinfo] page ${page} non préparée, service par le moteur Expo :`, error);
          return null;
        });
      pages.set(page, entry);
    }
    return entry;
  }

  return async function serveHtml(req, res) {
    const method = req.method ?? 'GET';
    if (method !== 'GET' && method !== 'HEAD') return false;
    const pathname = (req.url ?? '').split('?')[0].split('#')[0];
    if (pathname === '/api' || pathname.startsWith('/api/')) return false;

    const routes = await loadRoutes();
    if (!routes.supported) return false;
    const match = matchHtmlRoute(routes, pathname);
    if (!match || match.kind !== 'page') return false;

    const page = await loadPage(match.page);
    if (!page) return false; // Fichier manquant : le moteur Expo répondra (et journalisera).

    const { encoding } = pickEncoding(req.headers['accept-encoding'], { br: true, gzip: true });
    const enriched = enrich && match.status === 200 ? await enrich({ page: match.page, pathname, html: page.text }) : null;
    let body;
    let status = match.status;
    let headers = page.headers;
    if (enriched) {
      // Document propre à l'URL : compression rapide à la volée (quelques dizaines de Ko).
      const raw = Buffer.from(enriched.html, 'utf8');
      body =
        encoding === 'br'
          ? await brotli(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } })
          : encoding === 'gzip'
            ? await gzip(raw, { level: 6 })
            : raw;
      status = enriched.status;
      headers = headersFor(enriched.html);
    } else {
      body = encoding === 'br' ? page.br : encoding === 'gzip' ? page.gzip : page.raw;
    }

    res.statusCode = status;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', NO_STORE_CACHE_CONTROL);
    res.setHeader('Vary', 'Accept-Encoding');
    for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
    if (encoding) res.setHeader('Content-Encoding', encoding);
    res.setHeader('Content-Length', String(body.length));
    res.end(method === 'HEAD' ? undefined : body);
    return true;
  };
}
