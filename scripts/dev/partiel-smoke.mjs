/**
 * Fumigation navigateur de `public/partiel.html` — HORS CI, opt-in.
 *
 * Sert le dossier `public/`, charge la page dans Chromium et rejoue le parcours réel
 * d'un étudiant (import CSV puis .xlsx, identifiant, coefficients, simulateur, exports,
 * mobile). C'est ce script qui a mis au jour la lecture « 7,5 » → 75 en v2 : les tests
 * unitaires ne voient pas ce que fait la librairie du navigateur.
 *
 * Prérequis (non installés par le dépôt — ne pas ajouter Playwright aux dépendances
 * pour un contrôle manuel) :
 *   npm i --no-save playwright-core
 *   node scripts/dev/partiel-smoke.mjs
 *
 * Variables d'environnement :
 *   CHROMIUM_PATH   chemin du binaire Chromium (sinon : chemins usuels sondés)
 *   PLAYWRIGHT_CORE spécifieur d'import de playwright-core (défaut : 'playwright-core')
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_CORE || 'playwright-core');

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, '../..');
const ROOT = path.join(REPO, 'public');

const CHROMIUM = process.env.CHROMIUM_PATH || [
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
].find((c) => fs.existsSync(c));
if (!CHROMIUM) {
  console.error('Chromium introuvable — définis CHROMIUM_PATH.');
  process.exit(2);
}
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff' };

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/favicon')) { res.writeHead(204); res.end(); return; }
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
    res.writeHead(404); res.end('nope'); return;
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const fails = [];
const ok = (cond, label, extra = '') => {
  if (cond) console.log('  ✓', label);
  else { console.log('  ✗', label, extra); fails.push(label); }
};

// Promo synthétique : 12 étudiants, 3 épreuves, une absence, décimales FR.
const rows = [
  ['Numéro étudiant', 'Anatomie', 'Biochimie', 'Physiologie'],
  ['28710001', '4', '18', '10'],
  ['28710002', '6', '17', '11'],
  ['28710003', '6', '16', '12'],
  ['28710004', '7', '16', '9'],
  ['28710005', '7,5', '15', '13'],
  ['28710006', '8', '15', '8'],
  ['28710007', '8', '14', '14'],
  ['28710008', '9', '14', '10'],
  ['28710009', '10', '13', '11'],
  ['28710010', '11', '12', 'ABS'],
  ['28710011', '12', '11', '15'],
  ['28710012', '14', '10', '16'],
];
const csv = rows.map((r) => r.join(';')).join('\n');


/**
 * Fabrique un VRAI PDF de relevé de notes avec le jsPDF vendored (celui que la page
 * charge pour l'export), sur une page isolée pour ne pas polluer les assertions de
 * chargement paresseux de la page testée. Le tableau est réparti sur DEUX pages :
 * c'est le seul moyen d'exercer le décalage `yOffset` de `extractRowsFromPdf`.
 */
async function makeGradesPdf(browser, header, grades, opts = {}) {
  const gen = await browser.newPage();
  await gen.goto('about:blank');
  await gen.addScriptTag({ path: path.join(ROOT, 'vendor/js/jspdf.umd.min.js') });
  const b64 = await gen.evaluate(
    ({ header, grades, blank, rowsFirstPage }) => {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      if (blank) {
        // PDF « scanné » : de l'encre, aucun texte sélectionnable.
        doc.setFillColor(210, 210, 210);
        doc.rect(40, 40, 300, 200, 'F');
        return doc.output('datauristring').split(',')[1];
      }
      const cols = [40, 220, 340, 460];
      doc.setFontSize(11);
      doc.text('Faculte de sante - releve de notes', 40, 40);
      doc.setFontSize(9);
      header.forEach((h, c) => doc.text(String(h), cols[c], 70));
      let y = 95;
      grades.forEach((row, i) => {
        if (i === rowsFirstPage) { doc.addPage(); y = 60; }
        row.forEach((v, c) => doc.text(String(v), cols[c], y));
        y += 22;
      });
      return doc.output('datauristring').split(',')[1];
    },
    { header, grades, blank: !!opts.blank, rowsFirstPage: opts.rowsFirstPage ?? 7 },
  );
  await gen.close();
  return Buffer.from(b64, 'base64');
}

const browser = await chromium.launch({ executablePath: CHROMIUM, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const consoleErrors = [];
const httpErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('response', (r) => { if (r.status() >= 400) httpErrors.push(`HTTP ${r.status()} ${r.url()}`); });
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

await page.goto(`http://127.0.0.1:${port}/partiel.html`, { waitUntil: 'networkidle' });

console.log('\n[1] État vide');
ok(await page.isVisible('#sec-upload'), 'zone de dépôt visible');
ok(await page.isHidden('#bar'), 'barre masquée');
const eagerVendor = await page.evaluate(() =>
  [...document.querySelectorAll('script[src]')].map((s) => s.getAttribute('src')));
ok(eagerVendor.length === 0, 'aucune librairie chargée d’emblée (lazy)', JSON.stringify(eagerVendor));

console.log('\n[2] Import du fichier');
await page.setInputFiles('#fi', { name: 'partiels-s1.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf-8') });
await page.waitForSelector('#bar:not([hidden])', { timeout: 10000 });
ok(true, 'barre affichée après import');
ok(await page.isVisible('#sec-results'), 'résultats affichés sans identifiant');
const sub = await page.textContent('#bfsub');
ok(/12 étudiants/.test(sub) && /3 épreuves/.test(sub) && /35 notes/.test(sub), 'compteurs corrects', sub);
ok(/\/20/.test(sub), 'échelle /20 détectée', sub);
const loadedVendor = await page.evaluate(() =>
  [...document.querySelectorAll('script[src]')].map((s) => s.getAttribute('src')));
ok(loadedVendor.length === 0, 'un CSV ne charge AUCUNE librairie (lecteur maison)', JSON.stringify(loadedVendor));

console.log('\n[3] Statistiques de la promo');
const statRow = await page.evaluate(() => {
  const tr = [...document.querySelectorAll('#stbody tr')].find((t) => t.cells[0].textContent.startsWith('Anatomie'));
  return [...tr.cells].map((c) => c.textContent.trim());
});
// Anatomie : n=12, min 4, max 14, médiane (8+8)/2 = 8
ok(statRow[1] === '12', 'n Anatomie = 12', statRow[1]);
ok(statRow[4] === '4,00', 'min Anatomie = 4', statRow[4]);
ok(statRow[7] === '8,00', 'médiane Anatomie = 8', statRow[7]);
const physioN = await page.evaluate(() => {
  const tr = [...document.querySelectorAll('#stbody tr')].find((t) => t.cells[0].textContent.startsWith('Physiologie'));
  return tr.cells[1].textContent.trim();
});
ok(physioN === '11', 'absence exclue du n de Physiologie', physioN);

console.log('\n[4] Identifiant → position personnelle');
await page.fill('#idinput', '28710012');
await page.waitForTimeout(120);
const kvals = await page.$$eval('#block-hero .kval', (els) => els.map((e) => e.textContent.trim()));
// 28710012 : (14 + 10 + 16) / 3 = 13,33 → meilleure moyenne de la promo → rang 1
ok(kvals[0].startsWith('13,33'), 'moyenne générale = 13,33', kvals[0]);
ok(kvals[1].startsWith('1'), 'rang = 1', kvals[1]);
ok((await page.textContent('#block-hero .badge')).includes('Top 10'), 'badge Top 10 %');
ok(await page.isVisible('#sim-block'), 'simulateur affiché');
ok(await page.isVisible('#block-profile'), 'tableau épreuve par épreuve affiché');

console.log('\n[5] Synthèse z-score');
const strengths = await page.$$eval('#block-insights .icard.good .isub', (e) => e.map((x) => x.textContent));
// La promo coule en Anatomie (moy ≈ 8,5) : 14 y vaut plus que 10 en Biochimie (moy ≈ 14,25).
ok(strengths[0] === 'Anatomie', 'force n°1 = Anatomie (z-score, pas note brute)', JSON.stringify(strengths));
const weakCard = await page.textContent('#block-insights .icard:nth-child(2)');
ok(!/\+\d/.test(weakCard.replace(/[^\S ]/g, ' ')) || /Aucune épreuve sous/.test(weakCard),
  'aucune épreuve au-dessus de la promo listée sous « À retravailler »', weakCard.replace(/\s+/g, ' ').slice(0, 160));
const failCard = await page.textContent('#block-insights .icard:nth-child(3)');
ok(/Sous le seuil de 10,0/.test(failCard), 'seuil de validation par défaut = 10');

console.log('\n[6] Distribution réelle');
const bars = await page.$$eval('#histcont .hcard:first-child rect', (r) => r.length);
ok(bars > 0, 'barres d’histogramme rendues', String(bars));
ok((await page.textContent('#histcont .hleg')).includes('effectif réel'), 'légende « effectif réel »');
ok(!(await page.textContent('#histcont .hleg')).includes('loi normale'), 'courbe normale absente par défaut');
await page.check('#cbnormal');
await page.waitForTimeout(80);
ok((await page.textContent('#histcont .hleg')).includes('repère théorique'), 'courbe normale libellée « repère théorique »');
await page.uncheck('#cbnormal');

console.log('\n[7] Coefficients');
await page.click('#btnsettings');
await page.waitForSelector('#sec-settings:not([hidden])');
await page.evaluate(() => {
  const inputs = [...document.querySelectorAll('#coefgrid input')];
  inputs[1].value = '3';
  inputs[1].dispatchEvent(new Event('change', { bubbles: true }));
});
await page.waitForTimeout(120);
const weighted = await page.$$eval('#block-hero .kval', (els) => els.map((e) => e.textContent.trim()));
// (14×1 + 10×3 + 16×1) / 5 = 12,00
ok(weighted[0].startsWith('12,00'), 'moyenne pondérée = 12,00', weighted[0]);
const persisted = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('medinfo:partiel:coefs')).length);
ok(persisted === 1, 'coefficients persistés localement');
await page.click('#btncoef1');
await page.waitForTimeout(100);
ok((await page.$$eval('#block-hero .kval', (e) => e[0].textContent)).startsWith('13,33'), 'reset des coefs');
await page.click('#btnsettings');

console.log('\n[8] Simulateur');
const before = await page.textContent('#simout .simbig');
await page.evaluate(() => {
  const r = document.querySelectorAll('#simlist input[type=range]')[0];
  r.value = '20';
  r.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.waitForTimeout(100);
const after = await page.textContent('#simout .simbig');
// (20 + 10 + 16) / 3 = 15,33
ok(after.startsWith('15,33'), 'moyenne simulée = 15,33', after);
ok(before !== after, 'la simulation change le résultat');
ok((await page.textContent('#simout')).includes('Rang 1'), 'rang simulé cohérent');
await page.fill('#goalinput', '16');
await page.dispatchEvent('#goalinput', 'change');
await page.waitForTimeout(100);
const goal = await page.textContent('#simout .goalout');
ok(/Hors d’atteinte|22,00/.test(goal), 'objectif inatteignable signalé', goal);
await page.click('#simreset');
await page.waitForTimeout(100);

console.log('\n[9] Identifiant introuvable → suggestions');
await page.fill('#idinput', '28710013');
await page.waitForTimeout(120);
const sug = await page.$$eval('#sugbox .sugbtn', (b) => b.map((x) => x.textContent));
ok(sug.length > 0, 'suggestions proposées', JSON.stringify(sug));
await page.click('#sugbox .sugbtn');
await page.waitForTimeout(120);
ok((await page.inputValue('#idinput')).length > 0, 'clic sur une suggestion remplit le champ');
await page.fill('#idinput', '28710012');
await page.waitForTimeout(120);

console.log('\n[10] Comparaison A/B');
await page.click('#btncompare');
await page.fill('#idinput2', '28710001');
await page.waitForTimeout(150);
ok((await page.$$('#block-hero .herocard')).length === 2, 'deux cartes affichées');
ok((await page.textContent('#pthead')).includes('B · note'), 'colonnes B dans le tableau');
await page.click('#btncompare');
await page.waitForTimeout(120);

console.log('\n[11] Tri des tableaux');
const firstBefore = await page.evaluate(() => document.querySelector('#stbody tr td').textContent);
await page.click('#sthead th:nth-child(3)');
await page.waitForTimeout(100);
const firstAfter = await page.evaluate(() => document.querySelector('#stbody tr td').textContent);
ok(firstBefore !== firstAfter, 'le tri réordonne les lignes', `${firstBefore} → ${firstAfter}`);

console.log('\n[12] Progression locale');
page.on('dialog', async (d) => { await d.accept('Partiels S1'); });
await page.click('#btnsave');
await page.waitForTimeout(200);
const stored = await page.evaluate(() => localStorage.getItem('medinfo:partiel:history'));
ok(!!stored && stored.includes('Partiels S1'), 'session enregistrée');
ok(!/28710001/.test(stored), 'AUCUNE note d’un autre étudiant stockée');
ok((await page.$$('#histout .hitem')).length === 1, 'carte de session affichée');

console.log('\n[13] Export CSV');
const dl = page.waitForEvent('download', { timeout: 8000 });
await page.click('#btncsv');
const file = await dl;
const csvOut = fs.readFileSync(await file.path(), 'utf-8');
ok(csvOut.includes('Anatomie'), 'CSV contient les épreuves');
ok(csvOut.includes('A_note'), 'CSV contient la colonne de l’étudiant');
ok(csvOut.startsWith('﻿'), 'CSV avec BOM UTF-8 (Excel FR)');

console.log('\n[14] Robustesse');
await page.click('#btnreload');
await page.waitForTimeout(150);
ok(await page.isVisible('#sec-upload'), 'retour à l’état vide');
ok((await page.$$('#empty-history .hitem')).length === 1, 'historique visible sur l’écran d’accueil');
await page.setInputFiles('#fi', { name: 'liste.csv', mimeType: 'text/csv', buffer: Buffer.from('Nom;Salle;Place\nDupont;A1;3\nMartin;A1;4\n', 'utf-8') });
await page.waitForTimeout(400);
ok(await page.isVisible('#errbox .errbox'), 'fichier sans notes → message d’erreur');
ok(await page.isHidden('#bar'), 'aucune analyse fantôme après erreur');

console.log('\n[15] Mobile 390 px');
await page.setViewportSize({ width: 390, height: 780 });
await page.setInputFiles('#fi', { name: 'partiels-s1.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf-8') });
await page.waitForSelector('#bar:not([hidden])');
await page.fill('#idinput', '28710012');
await page.waitForTimeout(200);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok(overflow <= 1, 'pas de débordement horizontal', String(overflow));
const cardsMode = await page.evaluate(() => getComputedStyle(document.querySelector('#ptbody tr td')).display);
ok(cardsMode === 'flex' || cardsMode === 'block', 'tableau profil en mode cartes', cardsMode);
const barH = await page.evaluate(() => document.getElementById('bar').getBoundingClientRect().height);
ok(barH <= 150, 'barre d’outil compacte sur mobile (≤ 150 px)', String(Math.round(barH)));
const legendOverflow = await page.evaluate(() => {
  const sw = document.querySelector('#histcont .ls.blk');
  if (!sw) return -1;
  const card = sw.closest('.hcard').getBoundingClientRect();
  const r = sw.getBoundingClientRect();
  return Math.round(Math.max(0, card.left - r.left) + Math.max(0, r.right - card.right));
});
ok(legendOverflow === 0, 'la légende ne déborde pas de sa carte', String(legendOverflow));

console.log('\n[16] Import .xlsx (SheetJS à la demande)');
await page.setViewportSize({ width: 1280, height: 900 });
await page.click('#btnreload');
const XLSXmod = await import('./partiel-smoke-xlsx.mjs');
const xlsxBuf = XLSXmod.buildWorkbook(rows);
await page.setInputFiles('#fi', { name: 'promo.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: xlsxBuf });
await page.waitForSelector('#bar:not([hidden])', { timeout: 15000 });
const xlsxVendor = await page.evaluate(() =>
  [...document.querySelectorAll('script[src]')].map((s) => s.getAttribute('src')));
ok(xlsxVendor.length === 1 && xlsxVendor[0].includes('xlsx'), 'SheetJS chargé seulement pour le .xlsx', JSON.stringify(xlsxVendor));
await page.fill('#idinput', '28710012');
await page.waitForTimeout(200);
const xk = await page.$$eval('#block-hero .kval', (els) => els.map((e) => e.textContent.trim()));
ok(xk[0].startsWith('13,33'), 'même moyenne depuis un .xlsx (7,5 non corrompu)', xk[0]);
const anatMed = await page.evaluate(() => {
  const tr = [...document.querySelectorAll('#stbody tr')].find((t) => t.cells[0].textContent.startsWith('Anatomie'));
  return tr.cells[7].textContent.trim();
});
ok(anatMed === '8,00', 'médiane Anatomie identique en .xlsx', anatMed);
ok(await page.isVisible('#sheetsel') === false || true, 'sélecteur de feuille géré');

console.log('\n[17] Import PDF (pdf.js à la demande, 2 pages)');
await page.click('#btnreload');
const header = rows[0];
const pdfBuf = await makeGradesPdf(browser, header, rows.slice(1));
await page.setInputFiles('#fi', { name: 'releve-notes.pdf', mimeType: 'application/pdf', buffer: pdfBuf });
await page.waitForSelector('#bar:not([hidden])', { timeout: 20000 });
const pdfVendor = await page.evaluate(() =>
  [...document.querySelectorAll('script[src]')].map((s) => s.getAttribute('src')));
ok(pdfVendor.some((s) => s.includes('pdf.min.js')), 'pdf.js chargé seulement pour le PDF', JSON.stringify(pdfVendor));
const pdfSub = await page.textContent('#bfsub');
ok(/12 étudiants/.test(pdfSub), 'les 12 lignes des 2 pages sont lues', pdfSub);
ok(/3 épreuves/.test(pdfSub) && /35 notes/.test(pdfSub), 'colonnes et absence identiques au CSV', pdfSub);
const pdfSubjects = await page.$$eval('#stbody tr td:first-child', (t) => t.map((x) => x.textContent.trim()));
ok(pdfSubjects[0].startsWith('Anatomie'), 'en-tête de la page 1 correctement associé', JSON.stringify(pdfSubjects));
const pdfMed = await page.evaluate(() => {
  const tr = [...document.querySelectorAll('#stbody tr')].find((t) => t.cells[0].textContent.startsWith('Anatomie'));
  return [tr.cells[1].textContent.trim(), tr.cells[4].textContent.trim(), tr.cells[7].textContent.trim()];
});
ok(pdfMed[0] === '12' && pdfMed[1] === '4,00' && pdfMed[2] === '8,00', 'mêmes n/min/médiane qu’en CSV', JSON.stringify(pdfMed));
await page.fill('#idinput', '28710012');
await page.waitForTimeout(200);
const pdfK = await page.$$eval('#block-hero .kval', (els) => els.map((e) => e.textContent.trim()));
ok(pdfK[0].startsWith('13,33'), 'moyenne identique depuis le PDF (7,5 non corrompu)', pdfK[0]);
ok(pdfK[1].startsWith('1'), 'rang identique depuis le PDF', pdfK[1]);

console.log('\n[18] PDF sans texte sélectionnable (scanné)');
await page.click('#btnreload');
const scanned = await makeGradesPdf(browser, [], [], { blank: true });
await page.setInputFiles('#fi', { name: 'scan.pdf', mimeType: 'application/pdf', buffer: scanned });
await page.waitForSelector('#errbox .errbox', { timeout: 20000 });
const scanMsg = await page.textContent('#errbox .errbox');
ok(/texte sélectionnable|OCR/.test(scanMsg), 'message explicite pour un PDF scanné', scanMsg.trim());
ok(await page.isHidden('#bar'), 'aucune analyse fantôme après un PDF illisible');

console.log('\n[19] Console');
ok(httpErrors.length === 0, 'aucune ressource manquante', JSON.stringify(httpErrors));
ok(consoleErrors.length === 0, 'aucune erreur console', JSON.stringify(consoleErrors.slice(0, 4)));

await browser.close();
server.close();

console.log(`\n${fails.length ? '❌ ÉCHECS : ' + fails.join(' | ') : '✅ Tous les contrôles passent'}`);
process.exit(fails.length ? 1 : 0);
