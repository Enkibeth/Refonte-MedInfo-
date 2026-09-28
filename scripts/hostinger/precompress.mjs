#!/usr/bin/env node
/**
 * Pré-compression des assets statiques de `dist/client` (Brotli + gzip).
 *
 * Sans CDN devant l'application, personne ne compresse à notre place : sans ce passage, le
 * bundle web (plusieurs Mo de JS) part en clair à chaque premier chargement. On compresse UNE FOIS au build plutôt qu'à chaque requête —
 * le serveur (`server/lib/serve-static.mjs`) sert ensuite `fichier.br` / `fichier.gz` selon
 * l'en-tête `Accept-Encoding`.
 *
 * Usage : `node scripts/hostinger/precompress.mjs [répertoire]` (défaut : `dist/client`).
 */
import { constants, brotliCompress, gzip } from 'node:zlib';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';

const brotliAsync = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

/** Extensions qui gagnent à être compressées (images et woff2 sont déjà compressées). */
const EXTENSIONS = new Set([
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

/** En dessous, l'en-tête de compression coûte plus que ce qu'il économise. */
const MIN_BYTES = 1024;
/** Au-dessus, on ne garde la variante que si elle fait gagner au moins 5 %. */
const MIN_RATIO = 0.95;

async function* walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

async function main() {
  const root = path.resolve(process.argv[2] ?? path.join(process.cwd(), 'dist', 'client'));

  try {
    await fs.access(root);
  } catch {
    console.error(`[precompress] répertoire introuvable : ${root} (lancer d'abord l'export web).`);
    process.exit(1);
  }

  let files = 0;
  let originalBytes = 0;
  let brotliBytes = 0;

  for await (const file of walk(root)) {
    const ext = path.extname(file).toLowerCase();
    if (!EXTENSIONS.has(ext)) continue;
    if (file.endsWith('.br') || file.endsWith('.gz')) continue;

    const source = await fs.readFile(file);
    if (source.length < MIN_BYTES) continue;

    const [br, gz] = await Promise.all([
      brotliAsync(source, {
        params: {
          [constants.BROTLI_PARAM_QUALITY]: 11,
          [constants.BROTLI_PARAM_SIZE_HINT]: source.length,
        },
      }),
      gzipAsync(source, { level: 9 }),
    ]);

    let wrote = false;
    if (br.length < source.length * MIN_RATIO) {
      await fs.writeFile(`${file}.br`, br);
      wrote = true;
    }
    if (gz.length < source.length * MIN_RATIO) {
      await fs.writeFile(`${file}.gz`, gz);
      wrote = true;
    }

    if (wrote) {
      files += 1;
      originalBytes += source.length;
      brotliBytes += Math.min(br.length, gz.length);
    }
  }

  const mb = (n) => (n / 1024 / 1024).toFixed(1);
  console.log(
    `[precompress] ${files} fichiers compressés dans ${path.relative(process.cwd(), root) || root} — ` +
      `${mb(originalBytes)} Mo → ${mb(brotliBytes)} Mo servis (meilleure variante).`,
  );
}

main().catch((error) => {
  console.error('[precompress] échec :', error);
  process.exit(1);
});
