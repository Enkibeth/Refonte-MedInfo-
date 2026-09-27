// Essai RÉEL du chat invité sur l'aperçu Vercel de la branche (1 message par contexte,
// parcours public normal, aucune protection contournée). Mesures seulement.
import { launch } from './browser.mjs';
import fs from 'node:fs';
const SHARE = process.argv[2]; // URL de partage (_vercel_share) de l'aperçu
const OUT = process.argv[3];
fs.mkdirSync(OUT, { recursive: true });
const origin = new URL(SHARE).origin;
const instrument = fs.readFileSync(new URL('./instrument.js', import.meta.url), 'utf8');
const browser = await launch();
const results = {};
async function session(name, { width, height, bot, question, stopAfterMs = null }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  await context.addInitScript(instrument);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  const chatResponses = [];
  page.on('response', (r) => { if (r.url().includes('/api/chat')) chatResponses.push({ status: r.status(), type: r.headers()['content-type'] }); });
  await page.goto(SHARE, { waitUntil: 'domcontentloaded' });
  await page.goto(`${origin}/chat?bot=${bot}`, { waitUntil: 'networkidle' });
  await page.getByLabel('Votre question').waitFor({ timeout: 30000 });
  await page.getByLabel('Votre question').fill(question);
  await page.locator('[aria-label="Envoyer le message"]').click();
  let r = {};
  try {
    await page.waitForFunction(() => window.__bench.firstText !== null, null, { timeout: 90000 });
    if (stopAfterMs !== null) {
      await page.waitForTimeout(stopAfterMs);
      await page.locator('[aria-label="Arrêter la génération"]').click();
      const atStop = await page.evaluate(() => { window.__benchSample(); return window.__bench.textLen; });
      await page.waitForTimeout(4000);
      await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 72 });
      const b = await page.evaluate(() => { window.__benchSample(); return window.__bench; });
      const notice = await page.getByText(/Lecture interrompue/).allInnerTexts();
      r = { textAtStop: atStop, textAfter4s: b.textLen, notice, leaks: b.leaks };
    } else {
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `${OUT}/${name}-streaming.jpg`, type: 'jpeg', quality: 72 });
      await page.waitForSelector('[aria-label="Copier la réponse"]', { timeout: 180000 });
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${OUT}/${name}-final.jpg`, type: 'jpeg', quality: 72, fullPage: false });
      const b = await page.evaluate(() => { window.__benchSample(); return window.__bench; });
      const raw = await page.locator('[data-testid="assistant-message"]').innerText();
      const thread = page.locator('[data-testid="chat-thread"]');
      const distFinal = await thread.evaluate((e) => Math.round(e.scrollHeight - e.clientHeight - e.scrollTop));
      r = {
        firstStatusMs: Math.round(b.firstStatus), firstTextMs: Math.round(b.firstText), doneMs: Math.round(b.doneAt),
        textLen: b.textLen, closedBlocks: b.maxClosed, closedMoves: b.closedMoves.length, leaks: b.leaks, footnoteIssues: b.footnoteIssues, footnotes: b.footnotes,
        checkboxes: await page.locator('[role="checkbox"]').count(),
        rawMarkers: { followupMarker: /\[1\]\s*\+\s*\[2\]/.test(raw), srcToken: /\(SRC\d/.test(raw), headingHashes: /^#{1,6}\s/m.test(raw), htmlComment: /<!--/.test(raw) },
        sourcesButton: await page.locator('[aria-label*="ources"]').count(),
        distFinal, layoutShiftAfterStart: +b.shifts.filter((s) => b.start && s.t >= b.start && !s.input).reduce((a, s) => a + s.v, 0).toFixed(4),
      };
    }
  } catch (e) { r.error = String(e).slice(0, 300); }
  r.chatResponses = chatResponses; r.errors = errors;
  results[name] = r;
  console.log(name, JSON.stringify(r).slice(0, 900));
  await context.close();
}
await session('real-student-390', { width: 390, height: 844, bot: 'student', question: 'Quels sont les principaux mécanismes physiopathologiques de l’hypertension artérielle essentielle ?' });
await session('real-public-1440', { width: 1440, height: 900, bot: 'public', question: 'À quoi sert la vitamine D dans l’organisme ?' });
await session('real-stop-390', { width: 390, height: 844, bot: 'public', question: 'Comment fonctionne un vaccin à ARN messager ?', stopAfterMs: 1500 });
fs.writeFileSync(`${OUT}/real-chat.json`, JSON.stringify(results, null, 2));
await browser.close();
