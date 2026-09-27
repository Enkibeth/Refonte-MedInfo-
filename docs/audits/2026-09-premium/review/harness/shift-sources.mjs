import { launch } from './browser.mjs';
const [base, route, width] = process.argv.slice(2);
const browser = await launch();
const context = await browser.newContext({ viewport: { width: +width, height: 900 } });
await context.route(/supabase\.co/, (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
await context.addInitScript(() => {
  window.__shifts = [];
  new PerformanceObserver((l) => { for (const e of l.getEntries()) {
    if (e.hadRecentInput) continue;
    window.__shifts.push({ t: Math.round(e.startTime), v: +e.value.toFixed(4), sources: (e.sources || []).slice(0, 5).map((s) => {
      const n = s.node; const d = n && n.nodeType === 1 ? n : n?.parentElement;
      return { el: d ? (d.getAttribute('data-testid') || d.getAttribute('aria-label') || d.tagName) + ' ' + (d.textContent || '').trim().slice(0, 40) : '?', prev: [Math.round(s.previousRect.x), Math.round(s.previousRect.y), Math.round(s.previousRect.width), Math.round(s.previousRect.height)], cur: [Math.round(s.currentRect.x), Math.round(s.currentRect.y), Math.round(s.currentRect.width), Math.round(s.currentRect.height)] };
    }) });
  } }).observe({ type: 'layout-shift', buffered: true });
});
const page = await context.newPage();
await page.goto(base + route, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
console.log(JSON.stringify(await page.evaluate(() => window.__shifts), null, 1).slice(0, 5000));
await browser.close();
