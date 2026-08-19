/**
 * Génère la table de largeurs de glyphes du moteur du CV (`public/cv-builder.html`).
 *
 * Le moteur mesure le texte avec CES chiffres : la coupure des lignes, l'alignement à
 * droite et la pagination affichés dans l'aperçu sont donc exactement ceux du PDF
 * exporté. Les valeurs sont lues dans jsPDF lui-même — polices standard du format PDF
 * (Helvetica, Times) ET polices embarquées (public/vendor/fonts/cv/*.ttf) — pour qu'il
 * soit IMPOSSIBLE que le moteur et le fichier produit divergent.
 *
 *   node scripts/dev/extract-pdf-font-metrics.cjs            # affiche le bloc à recopier
 *   node scripts/dev/extract-pdf-font-metrics.cjs --write    # remplace le bloc dans la page
 *
 * Les largeurs sont stockées en UNITÉS DE POLICE (entiers) avec l'`upm` de la famille :
 * `largeur = Σ unités × taille / upm`, ce qui reproduit le calcul de jsPDF au bit près.
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '../..');
const jspdf = require(path.join(REPO, 'public/vendor/js/jspdf.umd.min.js'));
const FONT_DIR = path.join(REPO, 'public/vendor/fonts/cv');
const PAGE = path.join(REPO, 'public/cv-builder.html');

// cp1252 : seuls les codes 128..159 diffèrent d'Unicode.
const HIGH = {
  128: '€', 130: '‚', 131: 'ƒ', 132: '„', 133: '…', 134: '†', 135: '‡', 136: 'ˆ', 137: '‰',
  138: 'Š', 139: '‹', 140: 'Œ', 142: 'Ž', 145: '‘', 146: '’', 147: '“', 148: '”', 149: '•',
  150: '–', 151: '—', 152: '˜', 153: '™', 154: 'š', 155: '›', 156: 'œ', 158: 'ž', 159: 'Ÿ',
};
const STYLES = ['normal', 'bold', 'italic', 'bolditalic'];
const FILE_STYLE = { normal: 'regular', bold: 'bold', italic: 'italic', bolditalic: 'bolditalic' };

/** Familles embarquées (fichiers TTF sous-ensemblés, cf. build-cv-fonts.mjs). */
const EMBEDDED = ['inter', 'sourcesans3', 'publicsans', 'ebgaramond', 'lora'];

/** `unitsPerEm` lu dans la table `head` du TTF (offset 18 de la table). */
function unitsPerEm(buffer) {
  const numTables = buffer.readUInt16BE(4);
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    if (buffer.toString('latin1', rec, rec + 4) === 'head') {
      return buffer.readUInt16BE(buffer.readUInt32BE(rec + 8) + 18);
    }
  }
  throw new Error('table head introuvable');
}

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const enc = (n) => ALPHA[(n >> 12) & 63] + ALPHA[(n >> 6) & 63] + ALPHA[n & 63];

const doc = new jspdf.jsPDF({ unit: 'pt', format: 'a4' });
const families = [];

function collect(key, upm, register) {
  const widths = {};
  for (const style of STYLES) {
    register(style);
    doc.setFontSize(upm); // taille = upm → getTextWidth rend directement des unités de police
    const row = [];
    for (let code = 32; code <= 255; code++) {
      const ch = HIGH[code] !== undefined ? HIGH[code] : String.fromCharCode(code);
      let units = 0;
      try { units = Math.round(doc.getTextWidth(ch)); } catch (_) { units = 0; }
      if (units < 0 || units > 262143) throw new Error(`largeur hors bornes : ${key}/${style} ${code} = ${units}`);
      row.push(units);
    }
    widths[style] = row.map(enc).join('');
  }
  families.push({ key, upm, widths });
}

for (const family of ['helvetica', 'times']) {
  collect(family, 1000, (style) => doc.setFont(family, style));
}

for (const slug of EMBEDDED) {
  const first = fs.readFileSync(path.join(FONT_DIR, `${slug}-regular.ttf`));
  const upm = unitsPerEm(first);
  collect(slug, upm, (style) => {
    const file = `${slug}-${FILE_STYLE[style]}.ttf`;
    const full = path.join(FONT_DIR, file);
    doc.addFileToVFS(file, fs.readFileSync(full).toString('base64'));
    doc.addFont(file, slug, style);
    doc.setFont(slug, style);
  });
}

// Contrôle : le calcul « Σ unités × taille / upm » doit rendre EXACTEMENT getTextWidth.
const CORPUS = ['Diplôme de formation approfondie', 'CHU de Lyon — cardiologie', 'œuvre « citée » 20 %', 'AaBbCc 0123456789'];
const dec = {};
for (const c of ALPHA) dec[c] = ALPHA.indexOf(c);
let worst = 0;
for (const fam of families) {
  for (const style of STYLES) {
    const s = fam.widths[style];
    const table = new Array(256).fill(0);
    for (let i = 0; i < s.length; i += 3) {
      table[32 + i / 3] = dec[s[i]] * 4096 + dec[s[i + 1]] * 64 + dec[s[i + 2]];
    }
    if (EMBEDDED.includes(fam.key)) {
      const file = `${fam.key}-${FILE_STYLE[style]}.ttf`;
      doc.addFileToVFS(file, fs.readFileSync(path.join(FONT_DIR, file)).toString('base64'));
      doc.addFont(file, fam.key, style);
    }
    doc.setFont(fam.key, style);
    doc.setFontSize(11);
    for (const text of CORPUS) {
      let sum = 0;
      for (const ch of text) {
        const cp = ch.codePointAt(0);
        const code = Object.keys(HIGH).find((k) => HIGH[k] === ch);
        sum += table[code !== undefined ? Number(code) : cp] || 0;
      }
      worst = Math.max(worst, Math.abs((sum * 11) / fam.upm - doc.getTextWidth(text)));
    }
  }
}
if (worst > 1e-6) throw new Error('Divergence moteur ↔ jsPDF : ' + worst);

const lines = families.map((f) => {
  const rows = STYLES.map((s) => `      ${s}: '${f.widths[s]}',`).join('\n');
  return `    ${f.key}: {\n      upm: ${f.upm},\n${rows}\n    },`;
});
const block = '  var FONT_METRICS = {\n' + lines.join('\n') + '\n  };';

if (process.argv.includes('--write')) {
  const html = fs.readFileSync(PAGE, 'utf-8');
  const start = html.indexOf('  var FONT_METRICS = {');
  const end = html.indexOf('\n  };', start);
  if (start < 0 || end < 0) throw new Error('bloc FONT_METRICS introuvable dans cv-builder.html');
  fs.writeFileSync(PAGE, html.slice(0, start) + block + html.slice(end + '\n  };'.length));
  console.error(`Écrit dans ${PAGE} — ${families.length} familles, écart max ${worst.toExponential(1)} pt.`);
} else {
  console.log(block);
  console.error(`OK — ${families.length} familles × ${STYLES.length} styles, écart max ${worst.toExponential(1)} pt.`);
}
