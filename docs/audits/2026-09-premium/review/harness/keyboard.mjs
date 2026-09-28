// Parcours clavier du chat (invité, banc local) : ordre de tabulation, menus et modales
// (ouverture au clavier, focus à l'intérieur, Échap, focus rendu au déclencheur).
import { launch } from './browser.mjs';
import fs from 'node:fs';
const [base, OUT] = process.argv.slice(2);
const browser = await launch();
await fetch(base + '/__scenario?set=' + encodeURIComponent(JSON.stringify({ text: 'PUBLIC_REAL_FORMAT', firstDelay: 500, every: 10, size: 40, errorAt: null, reasoning: true })));
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.route(/supabase\.co/, (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
const page = await context.newPage();
await page.goto(base + '/chat?bot=public', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const report = {};
const describe = () => page.evaluate(() => {
  const a = document.activeElement;
  if (!a || a === document.body) return null;
  const outline = getComputedStyle(a).outlineStyle !== 'none' && parseFloat(getComputedStyle(a).outlineWidth) > 0;
  return { label: a.getAttribute('aria-label') || a.getAttribute('placeholder') || (a.textContent || '').trim().slice(0, 40), role: a.getAttribute('role') || a.tagName.toLowerCase(), outline };
});
// 1. Ordre de tabulation depuis le haut de page.
report.tabOrder = [];
for (let i = 0; i < 16; i++) { await page.keyboard.press('Tab'); report.tabOrder.push(await describe()); }
// 2. Menus/popovers ouverts au clavier.
async function popup(label) {
  const trigger = page.locator(`[aria-label="${label}"]`).first();
  await trigger.focus();
  const before = await page.evaluate(() => document.querySelectorAll('[role=dialog],[role=menu],[aria-modal=true],[role=listbox]').length);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const opened = await page.evaluate(() => document.querySelectorAll('[role=dialog],[role=menu],[aria-modal=true],[role=listbox]').length);
  const expanded = await trigger.getAttribute('aria-expanded');
  const inside = await describe();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => document.querySelectorAll('[role=dialog],[role=menu],[aria-modal=true],[role=listbox]').length);
  const restored = await page.evaluate((l) => document.activeElement?.getAttribute('aria-label') === l, label);
  return { popupsBefore: before, popupsOpen: opened, ariaExpanded: expanded, focusWhileOpen: inside, popupsAfterEscape: after, focusRestored: restored };
}
report.toolsMenu = await popup('Ouvrir le menu des outils');
report.country = await popup('Choisir le pays');
// 3. Envoi au clavier puis modale de source.
await page.getByLabel('Votre question').focus();
await page.keyboard.type('Question clavier');
await page.keyboard.press('Enter');
await page.waitForSelector('[aria-label="Copier la réponse"]', { timeout: 30000 });
const sourcesToggle = page.getByRole('button', { name: /Sources \(/ }).first();
await sourcesToggle.focus();
await page.keyboard.press('Enter');
await page.waitForTimeout(300);
const card = page.locator('[aria-label^="Source SRC1"]').first();
report.sourceCardVisible = await card.count();
if (report.sourceCardVisible) {
  const label = await card.getAttribute('aria-label');
  report.sourceModal = await popup(label);
}
await page.screenshot({ path: `${OUT}/keyboard-final-1440.jpg`, type: 'jpeg', quality: 62 });
fs.writeFileSync(`${OUT}/keyboard.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 1).slice(0, 4000));
await browser.close();
