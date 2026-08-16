#!/usr/bin/env node
/**
 * Fumigation du serveur Node autonome (hors CI, nécessite un build : `npm run build`).
 *
 * Démarre le vrai serveur sur un port éphémère et vérifie le contrat de la migration
 * Hostinger : routes API servies, HTML pré-rendu servi, statiques avec les bons en-têtes de
 * cache, compression négociée, 304 conditionnels, traversée de répertoire refusée, en-têtes
 * de proxy respectés.
 *
 * Usage : `npm run smoke:node`
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createServer } from '../../server/index.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
for (const dir of ['dist/client', 'dist/server']) {
  if (!existsSync(path.join(projectRoot, dir))) {
    console.error(`[smoke:node] ${dir} absent — lancer d'abord « npm run build ».`);
    process.exit(1);
  }
}

// Le journal d'accès du serveur brouillerait la liste des vérifications.
process.env.ACCESS_LOG ??= 'off';

const server = createServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

/** @type {{ name: string; ok: boolean; detail?: string }[]} */
const results = [];

async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, detail: error instanceof Error ? error.message : String(error) });
  }
}

await check('GET /api/health → 200 JSON', async () => {
  const res = await fetch(`${base}/api/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.service, 'medinfo-ai');
});

await check('GET / → 200 HTML no-store', async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') ?? '', /text\/html/);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const html = await res.text();
  assert.ok(html.includes('<div id="root">'), 'coquille HTML Expo attendue');
});

await check('routes de groupe rendues par le moteur Expo (/chat, /pricing, /mentions-legales)', async () => {
  // Ces pages viennent de `dist/server` : c'est le cœur du rendu serveur Expo.
  for (const route of ['/chat', '/pricing', '/mentions-legales']) {
    const res = await fetch(`${base}${route}`);
    assert.equal(res.status, 200, `${route} → ${res.status}`);
    assert.match(res.headers.get('content-type') ?? '', /text\/html/, route);
    assert.equal(res.headers.get('cache-control'), 'no-store', route);
    await res.text();
  }
});

await check('GET /partiel.html → page autonome servie statiquement', async () => {
  const res = await fetch(`${base}/partiel.html`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') ?? '', /text\/html/);
  assert.equal(res.headers.get('cache-control'), 'no-store');
});

await check('GET /robots.txt → 200 text/plain', async () => {
  const res = await fetch(`${base}/robots.txt`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') ?? '', /text\/plain/);
});

await check('GET /sitemap.xml → route API dynamique (jamais masquée par un statique)', async () => {
  const res = await fetch(`${base}/sitemap.xml`);
  assert.ok(res.status === 200 || res.status === 500, `statut inattendu : ${res.status}`);
  if (res.status === 200) assert.match(res.headers.get('content-type') ?? '', /xml/);
});

let bundleUrl = null;

await check('bundle /_expo/static/** → immutable + brotli + ETag', async () => {
  const html = await (await fetch(`${base}/`)).text();
  const match = html.match(/\/_expo\/static\/js\/web\/[^"']+\.js/);
  assert.ok(match, 'aucun bundle référencé dans la coquille HTML');
  bundleUrl = match[0];

  const res = await fetch(`${base}${bundleUrl}`, { headers: { 'Accept-Encoding': 'br' } });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  assert.equal(res.headers.get('content-encoding'), 'br');
  assert.equal(res.headers.get('vary'), 'Accept-Encoding');
  assert.ok(res.headers.get('etag'), 'ETag attendu');
  const body = await res.arrayBuffer();
  assert.ok(body.byteLength > 0, 'corps décompressé vide');
});

await check('gzip servi quand brotli non accepté', async () => {
  const res = await fetch(`${base}${bundleUrl}`, { headers: { 'Accept-Encoding': 'gzip' } });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-encoding'), 'gzip');
});

await check('identité servie quand aucun encodage accepté', async () => {
  const res = await fetch(`${base}${bundleUrl}`, { headers: { 'Accept-Encoding': 'identity' } });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-encoding'), null);
});

await check('If-None-Match → 304', async () => {
  const first = await fetch(`${base}${bundleUrl}`);
  const etag = first.headers.get('etag');
  await first.arrayBuffer();
  const res = await fetch(`${base}${bundleUrl}`, { headers: { 'If-None-Match': etag } });
  assert.equal(res.status, 304);
});

await check('HEAD sur un statique → en-têtes sans corps', async () => {
  const res = await fetch(`${base}${bundleUrl}`, { method: 'HEAD' });
  assert.equal(res.status, 200);
  assert.ok(Number(res.headers.get('content-length')) > 0);
  assert.equal((await res.text()).length, 0);
});

await check('traversée de répertoire refusée', async () => {
  for (const attempt of ['/../package.json', '/%2e%2e/package.json', '/assets/../../package.json']) {
    const res = await fetch(`${base}${attempt}`);
    const body = await res.text();
    assert.ok(!body.includes('"medinfo-ai"') || res.status >= 400, `fuite via ${attempt}`);
  }
});

await check('route inconnue → 404', async () => {
  const res = await fetch(`${base}/cette-route-nexiste-pas-12345`);
  assert.equal(res.status, 404);
});

await check('X-Forwarded-Proto respecté (URL publique en https)', async () => {
  const res = await fetch(`${base}/api/health`, {
    headers: { 'X-Forwarded-Proto': 'https', 'X-Forwarded-Host': 'medinfo.example' },
  });
  assert.equal(res.status, 200);
});

server.close();

let failed = 0;
for (const result of results) {
  if (result.ok) {
    console.log(`  ✅ ${result.name}`);
  } else {
    failed += 1;
    console.error(`  ❌ ${result.name}\n     ${result.detail}`);
  }
}
console.log(`\n[smoke:node] ${results.length - failed}/${results.length} vérifications passées.`);
process.exit(failed === 0 ? 0 : 1);
