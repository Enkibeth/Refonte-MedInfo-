/**
 * Image de partage 1200 × 630 (Open Graph / carte « summary_large_image ») — public/social-card.png.
 *
 * Rendue par Chromium à partir des MÊMES polices locales, couleurs (src/ui/tokens.ts) et photo
 * d'accueil que le site : aucune police distante, aucun texte de promesse médicale. À relancer
 * si l'accroche, la palette ou la photo d'accueil changent :
 *   node scripts/design/social-card.mjs
 * Playwright est fourni par l'environnement de travail (MEDINFO_PLAYWRIGHT_DIR, sinon le module
 * global) ; ce n'est PAS une dépendance de l'application.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
function loadPlaywright() {
  for (const candidate of [process.env.MEDINFO_PLAYWRIGHT_DIR, 'playwright', '/opt/node22/lib/node_modules/playwright'].filter(Boolean)) {
    try {
      return require(candidate);
    } catch {
      /* candidat suivant */
    }
  }
  throw new Error('Playwright introuvable : définir MEDINFO_PLAYWRIGHT_DIR.');
}

const dataUri = (file, type) => `data:${type};base64,${fs.readFileSync(path.join(root, file)).toString('base64')}`;
const font = (file) => dataUri(`public/vendor/fonts/${file}`, 'font/woff2');

// Couleurs reprises de src/ui/tokens.ts (editorial.hero, text, textMuted, accent, editorial.photoMount).
const C = { hero: '#E8EFFA', ink: '#142034', muted: '#526174', accent: '#0052D6', mount: '#F0EAF8', rule: '#9DB7E6' };

const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
@font-face{font-family:'Inter';src:url(${font('Inter-latin.woff2')}) format('woff2');font-weight:400 700}
@font-face{font-family:'Schibsted Grotesk';src:url(${font('SchibstedGrotesk-latin.woff2')}) format('woff2');font-weight:400 700}
@font-face{font-family:'Source Serif 4';src:url(${font('SourceSerif4-normal.woff2')}) format('woff2');font-weight:200 900}
@font-face{font-family:'Source Serif 4';font-style:italic;src:url(${font('SourceSerif4-italic.woff2')}) format('woff2');font-weight:200 900}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1200px;height:630px}
body{background:${C.hero};color:${C.ink};font-family:'Inter',sans-serif;display:flex;padding:64px 64px 56px 72px;gap:56px;-webkit-font-smoothing:antialiased}
.text{flex:1;display:flex;flex-direction:column}
.logo{height:56px;width:auto;align-self:flex-start}
h1{font-family:'Source Serif 4',serif;font-weight:400;font-size:66px;line-height:1.08;letter-spacing:-1.2px;margin-top:64px}
h1 em{color:${C.accent}}
p{font-size:25px;line-height:1.45;color:${C.muted};margin-top:28px;max-width:560px;text-wrap:balance}
.foot{margin-top:auto;display:flex;align-items:center;gap:16px;font-family:'Schibsted Grotesk',sans-serif;font-weight:600;font-size:22px;color:${C.accent}}
.foot span.rule{width:32px;height:3px;background:${C.accent}}
.photo{width:420px;align-self:center;background:${C.mount};border-radius:16px;padding:18px}
.photo img{width:100%;height:440px;object-fit:cover;border-radius:10px;display:block}
</style></head><body>
<div class="text">
  <img class="logo" src="${dataUri('assets/brand/logo-wordmark.png', 'image/png')}" alt="">
  <h1>L’IA pour apprendre.<br><em>Des outils pour créer.</em></h1>
  <p>Trois assistants d’information médicale, des ECOS, un planning de révisions et des outils de création.</p>
  <div class="foot"><span class="rule"></span>medinfo-ai.com</div>
</div>
<div class="photo"><img src="${dataUri('assets/landing/medical-study-1000.webp', 'image/webp')}" alt=""></div>
</body></html>`;

const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
const out = path.join(root, 'public/social-card.png');
await page.screenshot({ path: out, type: 'png' });
await browser.close();
console.log(`[social-card] ${path.relative(root, out)} (${fs.statSync(out).size} octets)`);
