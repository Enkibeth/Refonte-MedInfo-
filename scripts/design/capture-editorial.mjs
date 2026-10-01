/**
 * Contrôle VISUEL local, sans compte ni appel métier. Ne remplace pas la recette.
 * Playwright est fourni par l'environnement de travail, pas ajouté à l'application.
 * Options : MEDINFO_PLAYWRIGHT_DIR, MEDINFO_CHROMIUM_EXECUTABLE,
 * MEDINFO_CHROMIUM_LIBDIR, MEDINFO_STATIC_VISUAL=1 (pré-rendu sans JavaScript).
 * Exécuter après npm run build depuis la racine du dépôt.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { createServer } from '../../server/index.mjs';
import { createStaticHandler } from '../../server/lib/serve-static.mjs';

const require = createRequire(import.meta.url);
const playwrightDirectory = process.env.MEDINFO_PLAYWRIGHT_DIR
  ?? (process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
    ? path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'playwright') : 'playwright');
const { chromium } = require(playwrightDirectory);
const output = path.resolve('docs/audits/2026-09-editorial-life');
const staticPreview = process.env.MEDINFO_STATIC_VISUAL === '1';
const prefix = staticPreview ? 'apercu' : 'accueil';
await fs.mkdir(output, { recursive: true });
process.env.ACCESS_LOG = 'off';
// Le mode statique montre uniquement le fichier public exporté. Il n'exécute
// ni le routeur applicatif ni les contrôles d'accès : ce n'est pas une recette.
const publicHtml = staticPreview ? await fs.readFile(path.resolve('dist/server/index.html')) : null;
const serveAssets = createStaticHandler({ root: path.resolve('dist/client') });
const server = staticPreview ? http.createServer(async (request, response) => {
  if (request.url === '/') {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(publicHtml);
    return;
  }
  if (await serveAssets(request, response)) return;
  response.writeHead(404);
  response.end('Not found');
}) : createServer();
await new Promise(resolve => server.listen(4174, '127.0.0.1', resolve));
const browser = await chromium.launch({
  headless: true,
  ...(process.env.MEDINFO_CHROMIUM_EXECUTABLE ? { executablePath: process.env.MEDINFO_CHROMIUM_EXECUTABLE } : {}),
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  env: { ...process.env,
    ...(process.env.MEDINFO_CHROMIUM_LIBDIR ? {
      LD_LIBRARY_PATH: process.env.MEDINFO_CHROMIUM_LIBDIR,
      FONTCONFIG_PATH: path.join(process.env.MEDINFO_CHROMIUM_LIBDIR, 'fonts'),
    } : {}),
  },
});
const report = {
  date: new Date().toISOString(),
  mode: staticPreview ? 'static-prerender-no-javascript' : 'client-javascript',
  scope: staticPreview
    ? 'Composition du fichier public dist/server/index.html servi directement, sans JavaScript ni routage applicatif. Ni recette fonctionnelle, ni validation de production.'
    : 'Composition et images de l’accueil anonyme. Ni recette fonctionnelle, ni validation de production.',
  knownIssues: 'Hydratation React #418 et précédent test de navigation non concluant : reprise Claude Code. Le build local actuel ne dispose pas des variables publiques de connexion ; aucune validation fonctionnelle en mode statique.',
  cases: [],
};
try {
  for (const width of [390, 768, 1024, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1100 }, reducedMotion: 'reduce', javaScriptEnabled: !staticPreview });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    const failedRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('requestfailed', request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
    const response = await page.goto('http://127.0.0.1:4174', { waitUntil: 'domcontentloaded' });
    const landing = page.locator('[data-mi~="landing-page"]');
    try {
      await landing.waitFor({ state: 'visible' });
    } catch (error) {
      const failure = { width, status: response?.status(), errors, body: (await page.locator('body').innerText()).slice(0,1200) };
      report.cases.push(failure);
      console.log(JSON.stringify(failure));
      await page.screenshot({ path: path.join(output, `capture-error-${width}.jpg`), quality: 86 });
      throw error;
    }
    await page.waitForFunction(() => [...document.images].filter(image => image.fetchPriority === 'high')
      .every(image => image.complete && image.naturalWidth > 0));
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(output, `${prefix}-${width}.jpg`), quality: 86 });
    const photos = landing.locator('img');
    for (const photo of await photos.all()) {
      await photo.scrollIntoViewIfNeeded();
      await photo.evaluate(image => image.decode());
    }
    const measurements = await landing.evaluate(element => ({
      images: [...element.querySelectorAll('img')].map(image => ({
        alt: image.alt, loaded: image.complete && image.naturalWidth > 0,
      })),
      overflow: [...element.querySelectorAll('*')].filter(node => {
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1);
      }).map(node => ({ tag: node.tagName, text: node.textContent.slice(0, 70) })),
      // FontFaceSet.check peut retourner true pour une famille absente ; les
      // faces effectivement déclarées sont donc consignées séparément.
      bodyFontCheck: document.fonts.check('16px "Inter"'),
      titleFontCheck: document.fonts.check('16px "Source Serif 4"'),
      fontFaces: [...document.fonts].map(font => ({ family: font.family, status: font.status })),
    }));
    if (width === 1440) {
      await page.locator('[data-mi~="landing-trust"]').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, `${prefix}-sources-1440.jpg`), quality: 86 });
      // Une fenêtre haute permet de capturer le ScrollView natif web sans le
      // modifier artificiellement en DOM ni produire une image remplie de vide.
      const height = await landing.evaluate(element => Math.ceil(element.getBoundingClientRect().height) + 650);
      await page.setViewportSize({ width, height: Math.min(height, 9000) });
      await page.getByRole('heading', { level: 1 }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, `${prefix}-complet-1440.jpg`), quality: 82 });
    }
    report.cases.push({ width, ...measurements, errors, failedRequests });
    console.log(JSON.stringify(report.cases.at(-1)));
    await context.close();
  }
} finally {
  await fs.writeFile(path.join(output, 'visual-check.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
