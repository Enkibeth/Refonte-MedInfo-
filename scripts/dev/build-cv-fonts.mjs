/**
 * Régénère les polices du créateur de CV (`public/vendor/fonts/cv/`).
 *
 * Cinq familles SIL OFL téléchargées depuis Google Fonts, puis SOUS-ENSEMBLÉES au jeu
 * WinAnsi — celui que le moteur de `public/cv-builder.html` sait écrire. Chaque .ttf sert
 * à la fois de webfont pour l'aperçu et de police embarquée dans le PDF : un seul fichier,
 * donc jamais de divergence entre l'écran et le fichier téléchargé.
 *
 * Prérequis (hors dépôt — réseau + Python) :
 *   pip install fonttools brotli
 *   node scripts/dev/build-cv-fonts.mjs
 *
 * Après régénération, relancer OBLIGATOIREMENT :
 *   node scripts/dev/extract-pdf-font-metrics.cjs
 * et recopier la table dans le bloc `@cv-engine` — sinon le moteur mesure avec les
 * anciennes largeurs et l'aperçu ment sur la pagination.
 *
 * Les licences OFL sont récupérées en même temps : ne jamais livrer un .ttf sans elle.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, '../../public/vendor/fonts/cv');
const TMP = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'cvfonts-'));

/** Familles livrées. `dir` = dossier dans github.com/google/fonts/ofl (pour la licence). */
const FAMILIES = [
  { slug: 'inter', query: 'Inter', dir: 'inter' },
  { slug: 'sourcesans3', query: 'Source+Sans+3', dir: 'sourcesans3' },
  { slug: 'publicsans', query: 'Public+Sans', dir: 'publicsans' },
  { slug: 'ebgaramond', query: 'EB+Garamond', dir: 'ebgaramond' },
  { slug: 'lora', query: 'Lora', dir: 'lora' },
];

const STYLES = { 'normal|400': 'regular', 'normal|700': 'bold', 'italic|400': 'italic', 'italic|700': 'bolditalic' };

/** Jeu WinAnsi exact : rien de plus (poids), rien de moins (le moteur écrirait « ? »). */
const CODES = [
  ...Array.from({ length: 0x100 - 0x20 }, (_, i) => 0x20 + i),
  0x152, 0x153, 0x160, 0x161, 0x178, 0x17d, 0x17e, 0x192, 0x2c6, 0x2dc,
  0x2013, 0x2014, 0x2018, 0x2019, 0x201a, 0x201c, 0x201d, 0x201e, 0x2020,
  0x2021, 0x2022, 0x2026, 0x2030, 0x2039, 0x203a, 0x20ac, 0x2122,
];
const UNICODES = CODES.map((c) => 'U+' + c.toString(16).toUpperCase().padStart(4, '0')).join(',');

const url = 'https://fonts.googleapis.com/css2?' +
  FAMILIES.map((f) => 'family=' + f.query + ':ital,wght@0,400;0,700;1,400;1,700').join('&');

// L'ancien user-agent est ce qui fait servir du TTF plutôt que du woff2.
const css = await (await fetch(url, { headers: { 'User-Agent': 'Mozilla/4.0' } })).text();
const blocks = css.match(/@font-face \{[\s\S]*?\}/g) || [];
if (blocks.length !== FAMILIES.length * 4) {
  throw new Error(`Attendu ${FAMILIES.length * 4} @font-face, reçu ${blocks.length}`);
}

fs.mkdirSync(OUT, { recursive: true });
let total = 0;

for (const block of blocks) {
  const family = /font-family: '([^']+)'/.exec(block)[1];
  const style = /font-style: (\w+)/.exec(block)[1];
  const weight = /font-weight: (\d+)/.exec(block)[1];
  const src = /url\((\S+?)\)/.exec(block)[1];
  const fam = FAMILIES.find((f) => f.query.replace(/\+/g, ' ') === family);
  if (!fam) throw new Error('Famille inattendue : ' + family);

  const name = `${fam.slug}-${STYLES[`${style}|${weight}`]}`;
  const raw = path.join(TMP, name + '.raw.ttf');
  fs.writeFileSync(raw, Buffer.from(await (await fetch(src)).arrayBuffer()));

  const out = path.join(OUT, name + '.ttf');
  execFileSync('pyftsubset', [
    raw, '--unicodes=' + UNICODES, '--output-file=' + out,
    '--no-hinting', '--desubroutinize', '--layout-features=', '--notdef-outline',
    '--drop-tables+=DSIG',
  ], { stdio: 'inherit' });

  const size = fs.statSync(out).size;
  total += size;
  console.log(`${name.padEnd(26)} ${(fs.statSync(raw).size / 1024).toFixed(0).padStart(4)} ko → ${(size / 1024).toFixed(1).padStart(5)} ko`);
}

for (const fam of FAMILIES) {
  const licence = await (await fetch(`https://raw.githubusercontent.com/google/fonts/main/ofl/${fam.dir}/OFL.txt`)).text();
  if (!/SIL OPEN FONT LICENSE/i.test(licence)) throw new Error('Licence OFL introuvable pour ' + fam.slug);
  fs.writeFileSync(path.join(OUT, fam.slug + '-OFL.txt'), licence);
}

fs.rmSync(TMP, { recursive: true, force: true });
console.log(`\nTotal : ${(total / 1024).toFixed(0)} ko — pense à relancer extract-pdf-font-metrics.cjs.`);
