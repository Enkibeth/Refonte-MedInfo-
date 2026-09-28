// axe sur le chat après une réponse complète (propositions, radios, sources ouvertes) + états ARIA.
import { launch } from './browser.mjs';
import fs from 'node:fs';
const [base, OUT] = process.argv.slice(2);
const browser = await launch();
const results = {};
for (const [bot, text] of [['student', 'STUDENT_REAL_FORMAT'], ['public', 'PUBLIC_REAL_FORMAT'], ['professional', 'PRO_FORMAT']]) {
  for (const [w, h] of [[390, 844], [1440, 900]]) {
    await fetch(base + '/__scenario?set=' + encodeURIComponent(JSON.stringify({ text, firstDelay: 300, every: 5, size: 60, errorAt: null, reasoning: true })));
    const context = await browser.newContext({ viewport: { width: w, height: h } });
    await context.route(/supabase\.co/, (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    const page = await context.newPage();
    await page.goto(`${base}/chat?bot=${bot}`, { waitUntil: 'networkidle' });
    await page.getByLabel('Votre question').fill('Question axe');
    await page.locator('[aria-label="Envoyer le message"]').click();
    await page.waitForSelector('[aria-label="Copier la réponse"]', { timeout: 30000 });
    const toggle = page.getByRole('button', { name: /Sources \(/ }).first();
    if (await toggle.count()) await toggle.click();
    const firstBox = page.locator('[role="checkbox"]').first();
    if (await firstBox.count()) await firstBox.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/chat-answer-${bot}-${w}.jpg`, type: 'jpeg', quality: 62, fullPage: false });
    await page.addScriptTag({ url: base + '/__axe.js' });
    const axe = await page.evaluate(async () => {
      const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
      return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, sample: v.nodes[0]?.target?.join(' ') }));
    });
    const aria = await page.evaluate(() => ({
      checkboxes: [...document.querySelectorAll('[role="checkbox"]')].map((e) => e.getAttribute('aria-checked')),
      tabs: [...document.querySelectorAll('[role="tab"]')].map((e) => e.getAttribute('aria-selected')),
    }));
    results[`${bot}-${w}`] = { axe, aria };
    console.log(bot, w, JSON.stringify(axe), JSON.stringify(aria));
    await context.close();
  }
}
fs.writeFileSync(`${OUT}/axe-chat.json`, JSON.stringify(results, null, 2));
await browser.close();
