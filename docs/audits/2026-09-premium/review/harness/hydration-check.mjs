// Matrice d'hydratation : erreurs React #418 / « Hydration failed » par page, largeur et préférences.
import { launch } from './browser.mjs';
const base = process.argv[2];
const routes = (process.argv[3] || '/,/chat,/chat?bot=student,/scores,/sign-in,/dashboard,/blog,/pricing,/a-propos,/legal').split(',');
const browser = await launch();
const PREFS = `try{localStorage.setItem('medinfo:chatCountry','FR');localStorage.setItem('medinfo:chatResponseMode','deep');localStorage.setItem('medinfo:chatTools','["diagram"]');localStorage.setItem('medinfo:chatHistoryCollapsed','1');}catch(e){}`;
const rows = [];
for (const route of routes) for (const width of [390, 1440]) for (const prefs of [false, true]) {
  const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 } });
  await context.route(/supabase\.co/, (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  if (prefs) await context.addInitScript(PREFS);
  const page = await context.newPage();
  const errs = [];
  page.on('pageerror', (e) => { const m = String(e.message || e); if (/418|Hydration|hydrat/i.test(m)) errs.push(m.slice(0, 160)); });
  page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && /418|Hydration failed|did not match/i.test(t)) errs.push(t.slice(0, 160)); });
  try { await page.goto(base + route, { waitUntil: 'networkidle', timeout: 45000 }); await page.waitForTimeout(1500); } catch (e) { errs.push('NAV ' + String(e).slice(0, 80)); }
  rows.push({ route, width, prefs, hydrationErrors: errs.length, first: errs[0] || '' });
  await context.close();
}
for (const r of rows) console.log(`${r.route.padEnd(18)} ${String(r.width).padEnd(5)} prefs=${r.prefs ? 'oui' : 'non'}  erreurs=${r.hydrationErrors} ${r.first}`);
await browser.close();
