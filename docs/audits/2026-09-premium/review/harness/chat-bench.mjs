// Scénarios de bout en bout du chat (invité, banc local, flux SSE synthétique non médical).
import { launch } from './browser.mjs';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:4173';
const OUT = process.argv[2];
const ONLY = process.argv[3];
fs.mkdirSync(OUT, { recursive: true });
const instrument = fs.readFileSync(new URL('./instrument.js', import.meta.url), 'utf8');
const browser = await launch();
const results = {};

const setScenario = (s) => fetch(`${BASE}/__scenario?set=${encodeURIComponent(JSON.stringify(s))}`).then((r) => r.json());
const serverLog = () => fetch(`${BASE}/__log`).then((r) => r.json());
const DEFAULT = { text: 'STUDENT_REAL_FORMAT', firstDelay: 900, every: 35, size: 12, errorAt: null, reasoning: true };

async function open({ width = 1440, height = 900, reducedMotion = 'no-preference', bot = 'student' } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion, deviceScaleFactor: 1 });
  // Le banc ne touche jamais aux données de production : Supabase est coupé.
  await context.route(/supabase\.co/, (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await context.addInitScript(instrument);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error' && !/503|Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  await page.goto(`${BASE}/chat?bot=${bot}`, { waitUntil: 'networkidle' });
  await page.getByLabel('Votre question').waitFor({ timeout: 20000 });
  return { context, page, errors };
}
async function ask(page, text = 'Question de test du banc local') {
  await page.getByLabel('Votre question').fill(text);
  await page.locator('[aria-label="Envoyer le message"]').click();
}
const bench = (page) => page.evaluate(() => { window.__benchSample(); return window.__bench; });
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 72 });
const waitDone = (page, timeout = 60000) => page.waitForSelector('[aria-label="Copier la réponse"]', { timeout });
function summarize(b, extra = {}) {
  const maxDist = b.scroll.length ? Math.max(...b.scroll.map((s) => s.dist)) : null;
  return {
    firstStatusMs: b.firstStatus && Math.round(b.firstStatus), firstStopMs: b.firstStop && Math.round(b.firstStop),
    firstTextMs: b.firstText && Math.round(b.firstText), doneMs: b.doneAt && Math.round(b.doneAt),
    closedBlocks: b.maxClosed, closedMoves: b.closedMoves, leaks: b.leaks, footnoteIssues: b.footnoteIssues, footnotes: b.footnotes,
    assistantMessages: b.assistantCount, samples: b.samples, maxScrollDistance: maxDist,
    layoutShiftAfterStart: +b.shifts.filter((s) => b.start && s.t >= b.start && !s.input).reduce((a, s) => a + s.v, 0).toFixed(4),
    ...extra,
  };
}
async function run(name, fn) {
  if (ONLY && !name.startsWith(ONLY)) return;
  try { results[name] = await fn(); } catch (e) { results[name] = { error: String(e).slice(0, 400) }; }
  console.log(name, JSON.stringify(results[name]).slice(0, 600));
}

// 1. Premier envoi, rendu complet (format étudiant réel : ### SOURCES, relances après SOURCES).
for (const [bot, text] of [['student', 'STUDENT_REAL_FORMAT'], ['public', 'PUBLIC_REAL_FORMAT'], ['professional', 'PRO_FORMAT']]) {
  await run(`first-send-${bot}`, async () => {
    await setScenario({ ...DEFAULT, text });
    const { context, page, errors } = await open({ bot });
    await ask(page);
    await page.waitForFunction(() => window.__bench.firstText !== null, null, { timeout: 20000 });
    await page.waitForTimeout(700);
    await shot(page, `stream-${bot}-1440`);
    await waitDone(page);
    await page.waitForTimeout(400);
    await shot(page, `final-${bot}-1440`);
    const b = await bench(page);
    const followups = await page.locator('[role="checkbox"]').count();
    const raw = await page.locator('[data-testid="assistant-message"]').innerText();
    const log = await serverLog();
    await context.close();
    return summarize(b, { requests: log.length, checkboxes: followups, rawMarker: /\[1\]\s*\+/.test(raw), errors });
  });
}

// 2. Double clic sur Envoyer : une seule requête, une seule bulle.
await run('double-click', async () => {
  await setScenario(DEFAULT);
  const { context, page, errors } = await open();
  await page.getByLabel('Votre question').fill('Question double clic');
  await page.locator('[aria-label="Envoyer le message"]').dblclick();
  await page.waitForTimeout(2500);
  const log = await serverLog();
  const bubbles = await page.getByText('Question double clic', { exact: true }).count();
  await waitDone(page);
  await context.close();
  return { requests: log.length, userBubbles: bubbles, errors };
});

// 3. Arrêt avant le premier fragment.
await run('stop-before-first-fragment', async () => {
  await setScenario({ ...DEFAULT, firstDelay: 5000 });
  const { context, page, errors } = await open();
  await ask(page, 'Question arrêtée avant réponse');
  await page.waitForTimeout(900);
  await shot(page, 'stop-before-first-waiting-1440');
  await page.locator('[aria-label="Arrêter la génération"]').click();
  await page.waitForTimeout(6000);
  await shot(page, 'stop-before-first-after-1440');
  const b = await bench(page);
  const notice = await page.getByText(/Lecture interrompue/).allInnerTexts();
  const status = await page.locator('[role=status]').count();
  const stopBtn = await page.locator('[aria-label="Arrêter la génération"]').count();
  const log = await serverLog();
  await context.close();
  return { firstStatusMs: Math.round(b.firstStatus), assistantMessages: b.assistantCount, assistantText: b.textLen, notice, statusVisible: status, stopVisible: stopBtn, server: log.map((l) => l.closedAt), errors };
});

// 4. Arrêt pendant le flux : le texte reçu reste, plus rien n'arrive.
await run('stop-during-stream', async () => {
  await setScenario(DEFAULT);
  const { context, page, errors } = await open();
  await ask(page);
  await page.waitForFunction(() => window.__bench.firstText !== null, null, { timeout: 20000 });
  await page.waitForTimeout(1200);
  await page.locator('[aria-label="Arrêter la génération"]').click();
  const atStop = (await bench(page)).textLen;
  await page.waitForTimeout(2500);
  await shot(page, 'stop-during-stream-1440');
  const b = await bench(page);
  const notice = await page.getByText(/Lecture interrompue/).allInnerTexts();
  const actions = await page.locator('[aria-label="Copier la réponse"]').count();
  const log = await serverLog();
  await context.close();
  return summarize(b, { textAtStop: atStop, textAfter: b.textLen, notice, actions, server: log.map((l) => l.closedAt), errors });
});

// 5. Coupure réseau pendant le flux puis Réessayer.
await run('network-error-then-retry', async () => {
  await setScenario({ ...DEFAULT, errorAt: 0.4 });
  const { context, page, errors } = await open();
  await ask(page);
  const banner = page.getByText(/Une erreur est survenue/);
  await banner.waitFor({ timeout: 30000 });
  await page.waitForTimeout(300);
  await shot(page, 'network-error-1440');
  const partial = (await bench(page)).textLen;
  await setScenario(DEFAULT);
  await page.locator('[aria-label="Réessayer la dernière question"]').click();
  await waitDone(page);
  await page.waitForTimeout(400);
  const b = await bench(page);
  const log = await serverLog();
  const checkboxes = await page.locator('[role="checkbox"]').count();
  await context.close();
  return summarize(b, { partialTextAtError: partial, retryRequests: log.length, retryUsersInRequest: log.map((l) => l.users), checkboxes, errors });
});

// 6. Nouvelle conversation pendant l'attente : l'ancien flux n'écrit jamais dans le nouveau fil.
await run('new-conversation-while-waiting', async () => {
  await setScenario({ ...DEFAULT, firstDelay: 3500 });
  const { context, page, errors } = await open();
  await ask(page, 'Question abandonnée');
  await page.waitForTimeout(1000);
  await page.locator('[aria-label="Nouvelle conversation"]').click();
  await page.waitForTimeout(6000);
  await shot(page, 'new-conversation-while-waiting-1440');
  const b = await bench(page);
  const leftovers = await page.getByText('Question abandonnée').count();
  const log = await serverLog();
  await context.close();
  return { assistantMessages: b.assistantCount, assistantText: b.textLen, userBubbleLeft: leftovers, server: log.map((l) => l.closedAt), errors };
});

// 7. Régénération : l'ancienne réponse est remplacée, le rendu repart de zéro sans doublon.
await run('regenerate', async () => {
  await setScenario({ ...DEFAULT, text: 'PUBLIC_REAL_FORMAT' });
  const { context, page, errors } = await open({ bot: 'public' });
  await ask(page);
  await waitDone(page);
  const first = await page.locator('[data-testid="assistant-message"]').innerText();
  await page.locator('[aria-label="Régénérer la réponse"]').click();
  await page.waitForTimeout(1500);
  const during = await bench(page);
  await waitDone(page);
  await page.waitForTimeout(400);
  const b = await bench(page);
  const second = await page.locator('[data-testid="assistant-message"]').innerText();
  const log = await serverLog();
  await context.close();
  return summarize(b, { assistantDuring: during.assistantCount, sameFinalText: first === second, requests: log.length, usersPerRequest: log.map((l) => l.users), errors });
});

// 8. Défilement : suivi, lecture en remontant pendant le flux, retour en bas.
for (const [w, h] of [[1440, 900], [390, 844]]) {
  await run(`scroll-${w}`, async () => {
    await setScenario({ ...DEFAULT, text: 'LONG', every: 30, size: 10, firstDelay: 600 });
    const { context, page, errors } = await open({ width: w, height: h, bot: 'public' });
    await ask(page);
    await page.waitForFunction(() => window.__bench.firstText !== null, null, { timeout: 20000 });
    // Attendre que le fil déborde nettement avant de remonter (lecture pendant le flux).
    await page.waitForFunction(() => { const t = document.querySelector('[data-testid="chat-thread"]'); return t && t.scrollHeight - t.clientHeight > 700; }, null, { timeout: 30000 });
    const followBefore = (await bench(page)).scroll.slice(-20).map((s) => s.dist);
    const thread = page.locator('[data-testid="chat-thread"]');
    const box = await thread.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -500);
    await page.waitForTimeout(300);
    const topAfterWheel = await thread.evaluate((e) => e.scrollTop);
    await page.waitForTimeout(1500);
    const topLater = await thread.evaluate((e) => e.scrollTop);
    const button = await page.locator('[aria-label="Revenir en bas de la conversation"]').count();
    await shot(page, `scroll-reading-${w}`);
    await page.locator('[aria-label="Revenir en bas de la conversation"]').click();
    await page.waitForTimeout(1500);
    const distAfterReturn = await thread.evaluate((e) => e.scrollHeight - e.clientHeight - e.scrollTop);
    await waitDone(page);
    await page.waitForTimeout(500);
    const distFinal = await thread.evaluate((e) => e.scrollHeight - e.clientHeight - e.scrollTop);
    await shot(page, `scroll-final-${w}`);
    const b = await bench(page);
    await context.close();
    return summarize(b, { followBefore, topAfterWheel, topLater, readingPositionHeld: Math.abs(topLater - topAfterWheel) < 2, backToBottomButton: button, distAfterReturn: Math.round(distAfterReturn), distFinal: Math.round(distFinal), errors });
  });
}

// 9. Onglet masqué puis visible pendant le flux (veille simulée par visibilitychange/pageshow).
await run('visibility-during-stream', async () => {
  await setScenario(DEFAULT);
  const { context, page, errors } = await open();
  await ask(page);
  await page.waitForFunction(() => window.__bench.firstText !== null, null, { timeout: 20000 });
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pageshow')); });
  await waitDone(page);
  await page.waitForTimeout(400);
  const b = await bench(page);
  const errorBanner = await page.getByText(/Une erreur est survenue/).count();
  const log = await serverLog();
  await context.close();
  return summarize(b, { errorBanner, requests: log.length, errors });
});

// 10. Mouvement réduit (émulation Chromium réelle de prefers-reduced-motion).
await run('reduced-motion', async () => {
  await setScenario({ ...DEFAULT, firstDelay: 2500 });
  const { context, page, errors } = await open({ reducedMotion: 'reduce' });
  const matches = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  await ask(page);
  await page.waitForTimeout(1200);
  const waitingAnimations = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').map((a) => a.animationName || a.constructor.name));
  await shot(page, 'reduced-motion-waiting-1440');
  await page.waitForFunction(() => window.__bench.firstText !== null, null, { timeout: 20000 });
  await page.waitForTimeout(800);
  const streamingAnimations = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').map((a) => a.animationName || a.constructor.name));
  await waitDone(page);
  const b = await bench(page);
  await context.close();
  return summarize(b, { mediaMatches: matches, waitingAnimations, streamingAnimations, errors });
});

// 11. Zone de lecture agrandie pendant le flux (fenêtre agrandie, bandeau qui disparaît…) :
// le navigateur abaisse la position pour rester en bas. Ce n'est pas une lecture : le suivi
// doit continuer. Plusieurs agrandissements, car le défaut dépendait de l'ordre entre
// l'événement de défilement (limité à 80 ms) et le fragment suivant.
for (const [w, h, grown] of [[1440, 700, 900], [390, 700, 844]]) {
  await run(`viewport-grows-${w}`, async () => {
    await setScenario({ ...DEFAULT, text: 'LONG', every: 30, size: 10, firstDelay: 600 });
    const { context, page, errors } = await open({ width: w, height: h, bot: 'public' });
    await ask(page);
    await page.waitForFunction(() => window.__bench.firstText !== null, null, { timeout: 20000 });
    await page.waitForFunction(() => { const t = document.querySelector('[data-testid="chat-thread"]'); return t && t.scrollHeight - t.clientHeight > 200; }, null, { timeout: 30000 });
    const thread = page.locator('[data-testid="chat-thread"]');
    for (let i = 0; i < 6; i++) {
      await page.setViewportSize({ width: w, height: grown });
      await page.waitForTimeout(220);
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(220);
    }
    await page.setViewportSize({ width: w, height: grown });
    await page.waitForTimeout(800);
    const stillStreaming = await page.locator('[aria-label="Arrêter la génération"]').count();
    const distDuringStream = await thread.evaluate((e) => e.scrollHeight - e.clientHeight - e.scrollTop);
    const button = await page.locator('[aria-label="Revenir en bas de la conversation"]').count();
    await waitDone(page);
    await page.waitForTimeout(500);
    const distFinal = await thread.evaluate((e) => e.scrollHeight - e.clientHeight - e.scrollTop);
    const b = await bench(page);
    await context.close();
    return summarize(b, { stillStreaming, distDuringStream: Math.round(distDuringStream), backToBottomButton: button, distFinal: Math.round(distFinal), errors });
  });
}

fs.writeFileSync(`${OUT}/chat-bench.json`, JSON.stringify(results, null, 2));
await browser.close();
