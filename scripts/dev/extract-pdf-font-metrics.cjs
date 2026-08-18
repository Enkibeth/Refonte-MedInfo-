/**
 * Extraction des largeurs de glyphes des polices PDF standard (base 14) telles que
 * jsPDF les DÉCLARE dans le PDF (/Widths). Le moteur de mise en page du CV
 * (public/cv-builder.html) mesure le texte avec CES chiffres : l'aperçu à l'écran,
 * la coupure de lignes et la pagination sont donc exactement ceux du PDF exporté.
 *
 *   node scripts/dev/extract-pdf-font-metrics.cjs
 *
 * Sortie : bloc JS à recopier dans le moteur (table compacte, codes WinAnsi 32..255).
 */
const jspdf = require('../../public/vendor/js/jspdf.umd.min.js');

// cp1252 : codes 128..159 (le reste est identique à Latin-1 / Unicode).
const HIGH = {
  128: '€', 130: '‚', 131: 'ƒ', 132: '„', 133: '…', 134: '†',
  135: '‡', 136: 'ˆ', 137: '‰', 138: 'Š', 139: '‹', 140: 'Œ',
  142: 'Ž', 145: '‘', 146: '’', 147: '“', 148: '”', 149: '•',
  150: '–', 151: '—', 152: '˜', 153: '™', 154: 'š', 155: '›',
  156: 'œ', 158: 'ž', 159: 'Ÿ',
};

const doc = new jspdf.jsPDF({ unit: 'pt', format: 'a4' });
const fonts = [];
for (const family of ['helvetica', 'times']) {
  for (const style of ['normal', 'bold', 'italic', 'bolditalic']) {
    doc.setFont(family, style);
    doc.setFontSize(1000);
    const widths = [];
    for (let b = 32; b <= 255; b++) {
      const ch = HIGH[b] !== undefined ? HIGH[b] : String.fromCharCode(b);
      let w = 0;
      try { w = doc.getTextWidth(ch); } catch (_) { w = 0; }
      widths.push(Math.round(w));
    }
    fonts.push({ key: family + ':' + style, widths });
  }
}

// Encodage compact : une largeur = 2 caractères base-64 (0..4095 largement suffisant).
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const enc = (n) => ALPHA[(n >> 6) & 63] + ALPHA[n & 63];

const lines = fonts.map((f) => `    '${f.key}': '${f.widths.map(enc).join('')}',`);
console.log('  var FONT_WIDTHS = {\n' + lines.join('\n') + '\n  };');
console.error('OK — ' + fonts.length + ' polices, ' + fonts[0].widths.length + ' codes chacune.');
