/**
 * Fumigation navigateur de `public/cv-builder.html` — HORS CI, opt-in.
 *
 * Sert le dossier `public/`, charge la page dans Chromium et rejoue le parcours réel :
 * modèle → ajout de rubrique → glisser-déposer → édition en ligne dans l'aperçu →
 * thème → photo → export PDF, puis VÉRIFIE LE FICHIER PRODUIT (nombre de pages,
 * texte extrait dans l'ordre, absence de doublon, absence d'image de page).
 * Les tests unitaires ne voient pas ce que fait le navigateur : c'est ici que se
 * détectent une erreur de console, un `<script>` qui ne se charge pas, un
 * téléchargement qui n'aboutit pas.
 *
 * Prérequis (non installés par le dépôt — ne pas ajouter Playwright aux dépendances
 * pour un contrôle manuel) :
 *   npm i --no-save playwright-core
 *   node scripts/dev/cv-smoke.mjs
 *
 * Variables d'environnement :
 *   CHROMIUM_PATH   chemin du binaire Chromium (sinon : chemins usuels sondés)
 *   PLAYWRIGHT_CORE spécifieur d'import de playwright-core (défaut : 'playwright-core')
 */
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
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
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.jpg': 'image/jpeg',
};

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

/** Extraction du texte d'un PDF non compressé (celui que produit jsPDF). */
function pdfText(buffer) {
  const raw = buffer.toString('latin1');
  const objects = {};
  const re = /(\d+) 0 obj([\s\S]*?)endobj/g;
  let m;
  while ((m = re.exec(raw))) objects[m[1]] = m[2];
  const contentIds = [...raw.matchAll(/\/Type \/Page\b[\s\S]*?\/Contents (\d+) 0 R/g)].map((x) => x[1]);
  const HIGH = {
    128: '€', 130: '‚', 131: 'ƒ', 132: '„', 133: '…', 134: '†', 135: '‡', 136: 'ˆ', 137: '‰',
    138: 'Š', 139: '‹', 140: 'Œ', 142: 'Ž', 145: '‘', 146: '’', 147: '“', 148: '”', 149: '•',
    150: '–', 151: '—', 152: '˜', 153: '™', 154: 'š', 155: '›', 156: 'œ', 158: 'ž', 159: 'Ÿ',
  };
  const decode = (s) => {
    let out = '';
    for (let i = 0; i < s.length; i++) {
      const code = s.charCodeAt(i);
      out += HIGH[code] || String.fromCharCode(code);
    }
    return out;
  };
  return contentIds.map((id) => {
    const stream = (objects[id] || '').match(/stream\r?\n([\s\S]*?)endstream/);
    if (!stream) return [];
    // Position + contenu : deux runs au MÊME point = calque de texte dupliqué.
    return [...stream[1].matchAll(/([-\d.]+) ([-\d.]+) Td\s*\(((?:\\.|[^\\()])*)\)\s*Tj/g)]
      .map((x) => ({ x: Number(x[1]), y: Number(x[2]), text: decode(x[3].replace(/\\([()\\])/g, '$1')) }));
  });
}

const browser = await chromium.launch({ executablePath: CHROMIUM });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', (err) => errors.push(String(err)));

console.log('\n▶ Chargement de la page');
await page.goto(`http://127.0.0.1:${port}/cv-builder.html`);
await page.waitForSelector('.page', { timeout: 10000 });
ok(errors.length === 0, 'aucune erreur de console au chargement', errors.join(' | '));
ok(await page.evaluate(() => !window.jspdf), 'jsPDF n\'est PAS chargé au premier rendu (chargement paresseux)');
const initialPages = await page.locator('.page').count();
ok(initialPages >= 1, 'au moins une page A4 rendue');

console.log('\n▶ Édition');
await page.click('#btn-header');
await page.fill('.pane-right input[type="text"] >> nth=0', 'Camille Rousseau');
await page.waitForTimeout(350);
ok((await page.locator('.tx').allTextContents()).includes('Camille Rousseau'), 'le nom saisi apparaît dans l\'aperçu');

await page.click('#btn-add-section');
await page.waitForTimeout(200);
ok((await page.locator('.sec').count()) > 0, 'rubrique ajoutée dans l\'arborescence');
await page.fill('.pane-right input[type="text"] >> nth=0', 'Mobilités internationales');
await page.waitForTimeout(350);
ok((await page.locator('.tx').allTextContents()).includes('MOBILITÉS INTERNATIONALES'),
  'la rubrique libre apparaît dans l\'aperçu, en majuscules');

console.log('\n▶ Édition en ligne dans l\'aperçu');
const target = page.locator('.tx[data-path="header.headline"]').first();
if (await target.count()) {
  await target.dblclick();
  await page.fill('.edit-overlay', 'Interne en médecine interne — CHU');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  ok((await page.locator('.tx').allTextContents()).includes('Interne en médecine interne — CHU'),
    'édition en ligne appliquée au document');
} else {
  ok(false, 'accroche éditable trouvée dans l\'aperçu');
}

console.log('\n▶ Glisser-déposer d\'une rubrique');
const titlesInPreview = async () => (await page.locator('.tx').allTextContents())
  .filter((t) => /^[A-ZÉÈÀÇÎÔÛ' ]{4,}$/.test(t));
const beforeOrder = await titlesInPreview();
const sections = page.locator('.pane-left .sec');
if ((await sections.count()) >= 3) {
  // `locator.dragTo()` ne déclenche pas le glisser-déposer HTML5 dans ce Chromium :
  // on pilote la souris pas à pas, c'est le geste réel de l'utilisateur.
  const from = await sections.nth(2).boundingBox();
  const to = await sections.nth(0).boundingBox();
  await page.mouse.move(from.x + 20, from.y + 10);
  await page.mouse.down();
  await page.mouse.move(from.x + 22, from.y + 4, { steps: 3 });
  await page.mouse.move(to.x + 20, to.y + 20, { steps: 12 });
  await page.mouse.move(to.x + 20, to.y + 3, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const afterOrder = await titlesInPreview();
  ok(JSON.stringify(afterOrder) !== JSON.stringify(beforeOrder),
    'le glisser-déposer réordonne les rubriques dans l\'aperçu',
    JSON.stringify(beforeOrder.slice(0, 3)) + ' → ' + JSON.stringify(afterOrder.slice(0, 3)));
} else {
  ok(false, 'au moins trois rubriques pour tester le glisser-déposer');
}

console.log('\n▶ Réordonnancement au clavier (accessibilité)');
await page.locator('.pane-left .sec .sec-name').nth(2).click();
await page.waitForTimeout(150);
const orderBeforeKb = await titlesInPreview();
await page.getByRole('button', { name: '↑ Monter' }).first().click();
await page.waitForTimeout(400);
const orderAfterKb = await titlesInPreview();
ok(JSON.stringify(orderAfterKb) !== JSON.stringify(orderBeforeKb),
  'le bouton « Monter » réordonne sans souris');

console.log('\n▶ Thème');
await page.click('#itab-theme');
await page.click('.swatch >> nth=2');
await page.waitForTimeout(300);
ok(await page.evaluate(() => document.querySelectorAll('.page svg rect').length > 0), 'fond du bandeau rendu');

console.log('\n▶ Photo (import, redimensionnement, masque)');
await page.click('#btn-header');
await page.waitForTimeout(200);
const pngB64 = await page.evaluate(() => {
  const c = document.createElement('canvas');
  c.width = 1400; c.height = 1000;            // grande image : doit être réduite à 600 px
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 1400, 1000);
  g.addColorStop(0, '#7c1f3d'); g.addColorStop(1, '#f7c8d8');
  x.fillStyle = g; x.fillRect(0, 0, 1400, 1000);
  return c.toDataURL('image/png').split(',')[1];
});
await page.setInputFiles('.pane-right input[type="file"]', {
  name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from(pngB64, 'base64'),
});
await page.waitForTimeout(700);
ok((await page.locator('.page img').count()) > 0, 'la photo apparaît dans l\'aperçu A4');
const stored = await page.evaluate(() => {
  const key = Object.keys(localStorage).find((k) => k.startsWith('medinfo:cv:doc:'));
  const photo = JSON.parse(localStorage.getItem(key)).doc.header.photo;
  return { len: photo.dataUrl.length, isJpeg: photo.dataUrl.slice(0, 22) };
});
ok(stored.isJpeg.indexOf('image/jpeg') > 0, 'la photo est ré-encodée côté client', stored.isJpeg);
ok(stored.len < 300000, 'la photo est redimensionnée avant stockage (' + stored.len + ' octets base64)');

console.log('\n▶ Ajuster la mise en page');
await page.click('#btn-fit');
await page.waitForTimeout(200);
await page.fill('.modal input[type="number"]', '1');
await page.click('.modal-foot .btn-primary');
await page.waitForTimeout(500);
const fitMessage = await page.locator('.modal-body .hint').last().textContent();
ok(!!fitMessage && fitMessage.length > 10, 'l\'ajustement rend un verdict explicite : ' + (fitMessage || '').slice(0, 60));
await page.click('.modal-head .btn-ghost');
await page.waitForTimeout(150);

console.log('\n▶ Annuler / rétablir');
const before = await page.locator('.tx').allTextContents();
await page.keyboard.press('Control+z');
await page.waitForTimeout(250);
await page.keyboard.press('Control+Shift+z');
await page.waitForTimeout(250);
const after = await page.locator('.tx').allTextContents();
ok(JSON.stringify(before) === JSON.stringify(after), 'annuler puis rétablir restaure le même contenu');

console.log('\n▶ Export PDF');
const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 30000 }),
  page.click('#btn-pdf'),
]);
const out = path.join(os.tmpdir(), 'cv-smoke.pdf');
await download.saveAs(out);
const buf = fs.readFileSync(out);
ok(buf.length > 3000, 'PDF téléchargé (' + buf.length + ' octets)');
ok(/\.pdf$/.test(download.suggestedFilename()), 'nom de fichier .pdf : ' + download.suggestedFilename());

const pages = pdfText(buf);
const runs = pages.flat();
const flat = runs.map((r) => r.text);
ok(pages.length >= 1, 'PDF non vide : ' + pages.length + ' page(s)');
ok(flat.includes('Camille Rousseau'), 'le nom est du VRAI TEXTE dans le PDF (lisible par un ATS)');
ok(flat.some((t) => t.includes('MOBILITÉS INTERNATIONALES')), 'la rubrique libre est dans le texte extrait');
ok(flat.some((t) => t.includes('médecine interne')), 'accents et tirets cadratins corrects après extraction');
// La photo est une image (c'est normal) ; ce qui est interdit, c'est une image
// AUSSI GRANDE QUE LA PAGE, signe d'une capture d'écran déguisée en PDF.
const images = [...buf.toString('latin1').matchAll(/\/Subtype\s*\/Image[\s\S]{0,300}?\/Width (\d+)[\s\S]{0,120}?\/Height (\d+)/g)]
  .map((m) => ({ w: Number(m[1]), h: Number(m[2]) }));
ok(images.length <= 1, 'une seule image dans le PDF, la photo (pas de couche alpha séparée) : ' + JSON.stringify(images));
ok(buf.length < 200000, 'PDF léger malgré la photo (' + Math.round(buf.length / 1024) + ' ko)');
ok(images.every((i) => i.w <= 900 && i.h <= 900), 'aucune image de la taille d\'une page (pas de capture d\'écran)');
const seen = new Set();
const dup = runs.filter((r) => {
  const key = r.x.toFixed(1) + '|' + r.y.toFixed(1) + '|' + r.text;
  if (seen.has(key)) return true;
  seen.add(key);
  return false;
});
ok(dup.length === 0, 'aucun texte superposé au même point (pas de calque masqué)', JSON.stringify(dup.slice(0, 2)));
const nameIndex = flat.indexOf('Camille Rousseau');
const sectionIndex = flat.findIndex((t) => t.includes('MOBILITÉS'));
ok(nameIndex >= 0 && nameIndex < sectionIndex, 'ordre de lecture : en-tête avant les rubriques');

console.log('\n▶ Erreurs de console cumulées');
ok(errors.length === 0, 'aucune erreur JavaScript pendant le parcours', errors.slice(0, 3).join(' | '));

await browser.close();
server.close();
console.log(fails.length ? `\n${fails.length} échec(s).\n` : '\nTout est vert.\n');
process.exit(fails.length ? 1 : 0);
