// Mesures de laboratoire (pas de terrain) : FCP, LCP, CLS (fenêtres de session), erreurs
// d'hydratation, et durée des interactions (Event Timing) sur un scénario scripté.
import { launch } from './browser.mjs';
import fs from 'node:fs';
const [base, OUT, runsArg] = process.argv.slice(2);
const RUNS = Number(runsArg || 3);
const ROUTES = ['/', '/chat?bot=public', '/sign-in', '/pricing', '/blog'];
const PROFILES = [{ name: 'mobile-390-cpu4x', width: 390, height: 844, cpu: 4 }, { name: 'desktop-1440', width: 1440, height: 900, cpu: 1 }];
const browser = await launch();
const OBSERVE = () => {
  const m = (window.__m = { lcp: 0, fcp: 0, shifts: [], events: [] });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) m.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') m.fcp = e.startTime; }).observe({ type: 'paint', buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) m.shifts.push([e.startTime, e.value]); }).observe({ type: 'layout-shift', buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.interactionId) m.events.push([e.name, e.duration, e.interactionId]); }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
};
function cls(shifts) {
  let best = 0, cur = 0, start = -1, last = -1;
  for (const [t, v] of shifts) {
    if (start < 0 || t - last > 1000 || t - start > 5000) { cur = 0; start = t; }
    cur += v; last = t; best = Math.max(best, cur);
  }
  return best;
}
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const rows = [];
for (const profile of PROFILES) for (const route of ROUTES) {
  const samples = [];
  for (let run = 0; run < RUNS; run++) {
    const context = await browser.newContext({ viewport: { width: profile.width, height: profile.height } });
    await context.route(/supabase\.co/, (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    await context.addInitScript(OBSERVE);
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    if (profile.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpu });
    let hydration = 0;
    page.on('pageerror', (e) => { if (/418|Hydration/i.test(String(e.message))) hydration++; });
    await page.goto(base + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    let interactionMs = null;
    if (route.startsWith('/chat')) {
      const input = page.getByLabel('Votre question');
      await input.click();
      await page.keyboard.type('Test de saisie clavier', { delay: 30 });
      await page.locator('[aria-label="Choisir le pays"]').click();
      await page.waitForTimeout(400);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(600);
      const ev = await page.evaluate(() => window.__m.events);
      const byInteraction = new Map();
      for (const [, d, id] of ev) byInteraction.set(id, Math.max(byInteraction.get(id) ?? 0, d));
      interactionMs = byInteraction.size ? Math.max(...byInteraction.values()) : 0;
    }
    const m = await page.evaluate(() => window.__m);
    samples.push({ fcp: m.fcp, lcp: m.lcp, cls: cls(m.shifts), hydration, interactionMs });
    await context.close();
  }
  const row = {
    profile: profile.name, route, runs: RUNS,
    fcpMs: Math.round(median(samples.map((s) => s.fcp))), lcpMs: Math.round(median(samples.map((s) => s.lcp))),
    cls: +median(samples.map((s) => s.cls)).toFixed(4), hydrationErrors: samples.reduce((a, s) => a + s.hydration, 0),
    maxInteractionMs: samples[0].interactionMs === null ? null : Math.round(median(samples.map((s) => s.interactionMs))),
  };
  rows.push(row);
  console.log(JSON.stringify(row));
}
fs.writeFileSync(OUT, JSON.stringify(rows, null, 2));
await browser.close();
