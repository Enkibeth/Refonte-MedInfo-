#!/usr/bin/env node
/**
 * Fumigation du serveur Node autonome (hors CI, nécessite un build : `npm run build`).
 *
 * Démarre le vrai serveur sur un port éphémère et vérifie le contrat de la migration
 * Hostinger : routes API servies, HTML pré-rendu servi (compressé, avec sa CSP), en-têtes de
 * sécurité, statiques avec les bons en-têtes de cache, compression négociée, 304 conditionnels, traversée de répertoire refusée, en-têtes
 * de proxy respectés.
 *
 * Usage : `npm run smoke:node`
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createServer } from '../../server/index.mjs';
import { inlineScriptHashes } from '../../server/lib/security.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
for (const dir of ['dist/client', 'dist/server']) {
  if (!existsSync(path.join(projectRoot, dir))) {
    console.error(`[smoke:node] ${dir} absent — lancer d'abord « npm run build ».`);
    process.exit(1);
  }
}

// Le journal d'accès du serveur brouillerait la liste des vérifications.
process.env.ACCESS_LOG ??= 'off';
// Domaine canonique fictif : vérifie la redirection www → apex sans dépendre du vrai domaine.
process.env.CANONICAL_HOST = 'medinfo.example';
// Isolation : la fumigation vérifie le SERVEUR, jamais la base. Sans ces variables, les
// routes retombent sur leurs replis locaux (compteur de rate-limit en mémoire, sitemap
// statique) — aucune écriture possible dans le projet Supabase de production.
for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'EXPO_PUBLIC_SUPABASE_URL']) {
  delete process.env[key];
}

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

await check('HSTS posé derrière le proxy TLS, jamais en local', async () => {
  const proxied = await fetch(`${base}/`, {
    headers: { 'X-Forwarded-Proto': 'https', 'X-Forwarded-Host': 'medinfo.example' },
  });
  await proxied.text();
  assert.equal(proxied.headers.get('strict-transport-security'), 'max-age=63072000');
  assert.equal(proxied.headers.get('x-content-type-options'), 'nosniff');

  const local = await fetch(`${base}/`);
  await local.text();
  assert.equal(local.headers.get('strict-transport-security'), null);
});

await check('www.<canonique> → 308 vers le domaine canonique (chemin et query conservés)', async () => {
  const res = await fetch(`${base}/blog/article?x=1`, {
    redirect: 'manual',
    headers: { 'X-Forwarded-Proto': 'https', 'X-Forwarded-Host': 'www.medinfo.example' },
  });
  assert.equal(res.status, 308);
  assert.equal(res.headers.get('location'), 'https://medinfo.example/blog/article?x=1');
});

await check('un autre hôte (domaine temporaire de recette) n’est jamais redirigé', async () => {
  const res = await fetch(`${base}/api/health`, {
    redirect: 'manual',
    headers: { 'X-Forwarded-Proto': 'https', 'X-Forwarded-Host': 'recette.hostingersite.com' },
  });
  assert.equal(res.status, 200);
  await res.json();
});

await check('routes API : no-store + X-Accel-Buffering: no par défaut', async () => {
  const res = await fetch(`${base}/api/health`);
  await res.json();
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal(res.headers.get('x-accel-buffering'), 'no');
});

await check('X-Forwarded-For falsifié ne contourne pas le quota anonyme de /api/analyze', async () => {
  // Quota grand public : 10 requêtes/jour par IP (src/ai/rateLimit/chatRateLimit.ts), compteur
  // mémoire ici (Supabase neutralisé plus haut). Corps volontairement invalide : la route
  // compte la requête puis répond 400 AVANT tout appel LLM. Chaque requête prétend venir
  // d'une IP différente ; seule l'entrée ajoutée par le proxy (à droite) doit compter.
  let limited = false;
  for (let i = 0; i < 12 && !limited; i += 1) {
    const res = await fetch(`${base}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': `198.51.100.${i + 1}, 203.0.113.9`,
      },
      body: '{}',
    });
    await res.text();
    if (res.status === 429) limited = true;
  }
  assert.ok(limited, 'le quota aurait dû s’appliquer à l’IP réelle (203.0.113.9)');
});

// ── Fondations web (boucle « site ultra propre », 2026-10) ──────────────────────────

await check('en-têtes de sécurité sur HTML, statiques et API', async () => {
  for (const url of ['/', '/robots.txt', '/api/health']) {
    const res = await fetch(`${base}${url}`);
    await res.arrayBuffer();
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff', url);
    assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin', url);
    assert.equal(res.headers.get('x-frame-options'), 'SAMEORIGIN', url);
    assert.match(res.headers.get('permissions-policy') ?? '', /microphone=\(self\)/, url);
    assert.equal(res.headers.get('cross-origin-opener-policy'), 'same-origin-allow-popups', url);
  }
});

await check('coquille HTML : compressée, charset déclaré, CSP à empreintes couvrant ses scripts inline', async () => {
  const res = await fetch(`${base}/`, { headers: { 'Accept-Encoding': 'br' } });
  assert.equal(res.headers.get('content-encoding'), 'br');
  assert.equal(res.headers.get('content-type'), 'text/html; charset=utf-8');
  const csp = res.headers.get('content-security-policy') ?? '';
  const html = await res.text(); // fetch décompresse
  const hashes = inlineScriptHashes(html);
  assert.ok(hashes.length > 0, 'la coquille Expo contient au moins un script inline');
  for (const hash of hashes) assert.ok(csp.includes(hash), `empreinte absente de la CSP : ${hash}`);
  assert.match(csp, /frame-ancestors 'self'/);
  assert.doesNotMatch(csp, /'unsafe-eval'|script-src[^;]*'unsafe-inline'/);
});

await check('page autonome : CSP avec les empreintes de SES scripts', async () => {
  const res = await fetch(`${base}/cv-builder.html`);
  const csp = res.headers.get('content-security-policy') ?? '';
  for (const hash of inlineScriptHashes(await res.text())) assert.ok(csp.includes(hash), hash);
});

await check('adresse inconnue → page 404 de marque (statut 404, noindex)', async () => {
  const res = await fetch(`${base}/cette-page-nexiste-pas`);
  assert.equal(res.status, 404);
  assert.match(res.headers.get('content-type') ?? '', /text\/html/);
  const html = await res.text();
  assert.match(html, /<title[^>]*>Page introuvable \| MedInfo AI<\/title>/);
  assert.match(html, /noindex/);
});

await check('page d’outil : présentation publique dans le HTML servi (H1, texte, carte de partage)', async () => {
  const res = await fetch(`${base}/ecos`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /<h1[^>]*>Simulation ECOS<\/h1>/);
  assert.match(html, /15 stations fictives/);
  assert.match(html, /property="og:image" content="[^"]*\/social-card\.png"/);
  assert.match(html, /name="robots" content="index, follow, max-image-preview:large/);
  // Script de tête « session probable » couvert par la CSP à empreintes.
  const csp = res.headers.get('content-security-policy') ?? '';
  for (const hash of inlineScriptHashes(html)) assert.ok(csp.includes(hash), hash);
});

await check('coquilles d’outils autonomes jamais indexées seules', async () => {
  for (const page of ['/cv-builder.html', '/partiel.html', '/presentation.html', '/article.html']) {
    assert.match(await (await fetch(`${base}${page}`)).text(), /<meta name="robots" content="noindex, nofollow"/, page);
  }
});

await check('page de débogage /_sitemap d’Expo absente en production', async () => {
  const res = await fetch(`${base}/_sitemap`);
  assert.equal(res.status, 404);
  assert.doesNotMatch(await res.text(), /Sitemap/i);
});

await check('/llms.txt, /.well-known/security.txt et manifeste web servis', async () => {
  const llms = await fetch(`${base}/llms.txt`);
  assert.equal(llms.status, 200);
  assert.match(await llms.text(), /^# MedInfo AI/);
  const sec = await fetch(`${base}/.well-known/security.txt`);
  assert.equal(sec.status, 200);
  assert.match(await sec.text(), /^Contact: mailto:/m);
  const manifest = await fetch(`${base}/manifest.webmanifest`);
  assert.equal(manifest.status, 200);
  assert.match(manifest.headers.get('content-type') ?? '', /application\/manifest\+json/);
  assert.equal((await manifest.json()).start_url, '/');
});

await check('HEAD sur une page HTML → en-têtes sans corps', async () => {
  const res = await fetch(`${base}/pricing`, { method: 'HEAD' });
  assert.equal(res.status, 200);
  assert.ok(res.headers.get('content-security-policy'));
  assert.equal((await res.arrayBuffer()).byteLength, 0);
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
