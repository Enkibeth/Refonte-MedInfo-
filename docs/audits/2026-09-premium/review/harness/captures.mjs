// Captures + axe + débordement horizontal + erreurs d'hydratation, sur l'export local (invité).
import { launch } from './browser.mjs';
import fs from 'node:fs';
const [base, OUT, onlyArg] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const ROUTES = [['landing','/'],['chat-public','/chat?bot=public'],['chat-student','/chat?bot=student'],['chat-professional','/chat?bot=professional'],['sign-in','/sign-in'],['sign-up','/sign-in?mode=signup'],['reset-password','/reset-password'],['pricing','/pricing'],['blog','/blog'],['blog-missing','/blog/audit-slug-inexistant'],['a-propos','/a-propos'],['contact','/contact'],['legal','/legal'],['cgu','/cgu'],['confidentialite','/confidentialite'],['mentions-legales','/mentions-legales'],['dashboard','/dashboard'],['document','/document'],['ecos','/ecos'],['scores','/scores'],['partiel','/partiel'],['revision','/revision'],['cv-builder','/cv-builder'],['presentation','/presentation'],['article','/article'],['audio','/audio'],['account','/account'],['choose-role','/choose-role'],['standalone-partiel','/partiel.html'],['standalone-presentation','/presentation.html'],['standalone-cv','/cv-builder.html'],['standalone-article','/article.html']];
const WIDTHS = [[390, 844], [768, 900], [1024, 900], [1440, 900]];
const only = onlyArg ? onlyArg.split(',') : null;
const browser = await launch();
const results = [];
for (const [name, route] of ROUTES) {
  if (only && !only.includes(name)) continue;
  for (const [w, h] of WIDTHS) {
    const context = await browser.newContext({ viewport: { width: w, height: h } });
    await context.route(/supabase\.co/, (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    const page = await context.newPage();
    const hydration = [];
    page.on('pageerror', (e) => { const m = String(e.message || e); if (/418|Hydration/i.test(m)) hydration.push(m.slice(0, 120)); });
    let finalUrl = '';
    try {
      await page.goto(base + route, { waitUntil: 'networkidle', timeout: 45000 });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(900);
      finalUrl = page.url().replace(base, '');
      await page.screenshot({ path: `${OUT}/${name}-${w}.jpg`, type: 'jpeg', quality: 62 });
      const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
      await page.addScriptTag({ url: base + '/__axe.js' });
      const axe = await page.evaluate(async () => {
        const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
        return { violations: r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, sample: v.nodes[0]?.target?.join(' ') })), incomplete: r.incomplete.length };
      });
      results.push({ name, route, width: w, finalUrl, overflow, hydration: hydration.length, axe });
    } catch (e) {
      results.push({ name, route, width: w, error: String(e).slice(0, 200) });
    }
    await context.close();
  }
  const last = results.filter((r) => r.name === name);
  console.log(name.padEnd(24), last.map((r) => r.error ? `${r.width}:ERR` : `${r.width}:${r.axe.violations.map((v) => `${v.impact[0]}${v.id}`).join('+') || 'ok'}${r.overflow ? `/ovf${r.overflow}` : ''}${r.hydration ? '/H' : ''}`).join('  '));
}
fs.writeFileSync(`${OUT}/captures.json`, JSON.stringify(results, null, 2));
await browser.close();
