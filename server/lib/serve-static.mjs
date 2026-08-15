/**
 * Service des fichiers de `dist/client` (I/O) — pendant « exécutable » de `static.mjs`.
 *
 * Rôle repris à Vercel lors de la migration Node : lire le fichier, poser les en-têtes de
 * cache/validation, servir la variante précompressée (`.br`/`.gz`) quand le client
 * l'accepte, répondre 304 quand le client a déjà la bonne version.
 *
 * Retourne `true` si la requête a été traitée, `false` si elle doit continuer vers le
 * moteur Expo (HTML pré-rendu + routes API).
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import {
  cacheControlFor,
  contentTypeFor,
  etagFor,
  isCompressible,
  isNotModified,
  pickEncoding,
  resolveStaticPath,
} from './static.mjs';

/** @param {string} file */
async function statFile(file) {
  try {
    const stat = await fsp.stat(file);
    return stat.isFile() ? stat : null;
  } catch {
    return null;
  }
}

/**
 * @param {{ root: string; onError?: (error: unknown) => void }} params
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => Promise<boolean>}
 */
export function createStaticHandler({ root, onError }) {
  return async function serveStatic(req, res) {
    const method = req.method ?? 'GET';
    if (method !== 'GET' && method !== 'HEAD') return false;

    const pathname = (req.url ?? '').split('?')[0].split('#')[0];
    const filePath = resolveStaticPath(root, pathname);
    if (!filePath) return false;

    const stat = await statFile(filePath);
    if (!stat) return false;

    const decodedPathname = decodeURIComponent(pathname);
    const etag = etagFor(stat);
    const lastModified = new Date(stat.mtimeMs).toUTCString();
    const compressible = isCompressible(filePath);

    res.setHeader('Content-Type', contentTypeFor(filePath));
    res.setHeader('Cache-Control', cacheControlFor(decodedPathname));
    res.setHeader('Last-Modified', lastModified);
    res.setHeader('ETag', etag);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (compressible) res.setHeader('Vary', 'Accept-Encoding');

    if (
      isNotModified(
        {
          ifNoneMatch: req.headers['if-none-match'],
          ifModifiedSince: req.headers['if-modified-since'],
        },
        { etag, mtimeMs: stat.mtimeMs },
      )
    ) {
      res.statusCode = 304;
      res.end();
      return true;
    }

    // Variante précompressée (générée par `npm run build:node`) : le fichier d'origine
    // reste la source de l'ETag et du Last-Modified — c'est la même entité.
    let bodyPath = filePath;
    let bodySize = stat.size;
    if (compressible) {
      const [br, gz] = await Promise.all([
        statFile(`${filePath}.br`),
        statFile(`${filePath}.gz`),
      ]);
      const { encoding, suffix } = pickEncoding(req.headers['accept-encoding'], {
        br: Boolean(br),
        gzip: Boolean(gz),
      });
      if (encoding) {
        res.setHeader('Content-Encoding', encoding);
        bodyPath = `${filePath}${suffix}`;
        bodySize = (encoding === 'br' ? br : gz)?.size ?? bodySize;
      }
    }

    res.setHeader('Content-Length', String(bodySize));
    res.statusCode = 200;

    if (method === 'HEAD') {
      res.end();
      return true;
    }

    await new Promise((resolve) => {
      const stream = fs.createReadStream(bodyPath);
      stream.on('error', (error) => {
        onError?.(error);
        // Le client a déjà reçu les en-têtes : on ne peut plus émettre d'erreur propre.
        res.destroy();
        resolve(undefined);
      });
      res.on('close', () => {
        stream.destroy();
        resolve(undefined);
      });
      stream.pipe(res);
      res.on('finish', () => resolve(undefined));
    });

    return true;
  };
}
