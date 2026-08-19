/**
 * Extracteur de texte de PDF — la mesure de ce qu'un ATS lira.
 *
 * Le créateur de CV promet un PDF dont le texte est extractible. Le vérifier suppose de
 * relire le fichier COMME le fait un logiciel de tri : suivre les objets, retrouver le
 * flux de chaque page, savoir quelle police est active, et décoder les octets.
 *
 * Deux encodages sont produits par jsPDF :
 *  • polices standard du PDF (Helvetica, Times) → chaînes littérales `(…) Tj` en WinAnsi ;
 *  • polices embarquées (Inter, EB Garamond…) → `<hex> Tj` en Identity-H, où chaque code
 *    est un NUMÉRO DE GLYPHE. Sans la table `/ToUnicode`, ce texte est illisible pour un
 *    ATS : c'est précisément ce que ce module vérifie en la décodant.
 *
 * jsPDF n'active pas la compression : les flux se lisent tels quels.
 * (Une version allégée de cet extracteur vit dans `scripts/dev/cv-smoke.mjs`, qui ne peut
 * pas importer de TypeScript ; la version qui fait FOI est celle-ci.)
 */

/** cp1252 : seuls les codes 128..159 diffèrent d'Unicode. */
const CP1252_HIGH: Record<number, string> = {
  128: '€', 130: '‚', 131: 'ƒ', 132: '„', 133: '…', 134: '†', 135: '‡', 136: 'ˆ', 137: '‰',
  138: 'Š', 139: '‹', 140: 'Œ', 142: 'Ž', 145: '‘', 146: '’', 147: '“', 148: '”', 149: '•',
  150: '–', 151: '—', 152: '˜', 153: '™', 154: 'š', 155: '›', 156: 'œ', 158: 'ž', 159: 'Ÿ',
};

export type PdfRun = { x: number; y: number; text: string; font: string };

function objects(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /(\d+) 0 obj([\s\S]*?)endobj/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) out[m[1]] = m[2];
  return out;
}

function streamOf(body: string): string | null {
  const m = body.match(/stream\r?\n([\s\S]*?)endstream/);
  return m ? m[1] : null;
}

/** Table glyphe → caractère d'une police embarquée (`/ToUnicode`). */
function parseToUnicode(cmap: string): Record<number, string> {
  const map: Record<number, string> = {};
  const hex = (s: string) => String.fromCharCode(...(s.match(/.{4}/g) || []).map((h) => parseInt(h, 16)));
  for (const block of cmap.match(/beginbfchar([\s\S]*?)endbfchar/g) || []) {
    for (const m of block.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      map[parseInt(m[1], 16)] = hex(m[2]);
    }
  }
  for (const block of cmap.match(/beginbfrange([\s\S]*?)endbfrange/g) || []) {
    for (const m of block.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      const lo = parseInt(m[1], 16);
      const hi = parseInt(m[2], 16);
      const dst = parseInt(m[3].slice(0, 4), 16);
      for (let g = lo; g <= hi && g - lo < 65536; g++) map[g] = String.fromCharCode(dst + (g - lo));
    }
  }
  return map;
}

type FontInfo = { name: string; embedded: boolean; toUnicode: Record<number, string> };

function fontsOfPage(raw: string, objs: Record<string, string>, pageBody: string): Record<string, FontInfo> {
  const out: Record<string, FontInfo> = {};
  const resRef = pageBody.match(/\/Resources (\d+) 0 R/);
  const resBody = resRef ? objs[resRef[1]] : pageBody;
  const fontDict = (resBody || '').match(/\/Font\s*<<([\s\S]*?)>>/);
  if (!fontDict) return out;
  for (const m of fontDict[1].matchAll(/\/(F\d+)\s+(\d+) 0 R/g)) {
    const body = objs[m[2]] || '';
    const base = body.match(/\/BaseFont\s*\/([^\s/>]+)/);
    const toUnicodeRef = body.match(/\/ToUnicode (\d+) 0 R/);
    const embedded = /Identity-H/.test(body);
    let toUnicode: Record<number, string> = {};
    if (toUnicodeRef) {
      const stream = streamOf(objs[toUnicodeRef[1]] || '');
      if (stream) toUnicode = parseToUnicode(stream);
    }
    out[m[1]] = { name: base ? base[1] : '?', embedded, toUnicode };
  }
  return out;
}

function decodeLiteral(source: string): string {
  const unescaped = source.replace(/\\([()\\])/g, '$1').replace(/\\(\d{1,3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)));
  let out = '';
  for (let i = 0; i < unescaped.length; i++) {
    const code = unescaped.charCodeAt(i);
    out += CP1252_HIGH[code] || unescaped.charAt(i);
  }
  return out;
}

/**
 * Runs de texte d'un PDF, page par page, dans l'ordre où ils sont écrits (= l'ordre de
 * lecture d'un ATS), avec leur position — deux runs au même point trahiraient un calque
 * de texte dupliqué.
 */
export function readPdfRuns(buffer: Buffer): { pages: PdfRun[][]; raw: string } {
  const raw = buffer.toString('latin1');
  const objs = objects(raw);
  const pageIds = [...raw.matchAll(/\/Type \/Page\b[\s\S]*?\/Contents (\d+) 0 R/g)].map((m) => m[1]);
  const pageBodies = [...raw.matchAll(/\/Type \/Page\b([\s\S]*?)>>\s*endobj/g)].map((m) => m[1]);

  const pages = pageIds.map((id, index) => {
    const content = streamOf(objs[id] || '');
    if (!content) return [];
    const fonts = fontsOfPage(raw, objs, pageBodies[index] || '');
    const runs: PdfRun[] = [];
    let current = '';
    let x = 0;
    let y = 0;
    const token = /\/(F\d+)\s+[\d.]+\s+Tf|([-\d.]+)\s+([-\d.]+)\s+Td|\(((?:\\.|[^\\()])*)\)\s*Tj|<([0-9A-Fa-f\s]+)>\s*Tj/g;
    let m: RegExpExecArray | null;
    while ((m = token.exec(content))) {
      if (m[1]) { current = m[1]; continue; }
      if (m[2] !== undefined) { x = Number(m[2]); y = Number(m[3]); continue; }
      const font = fonts[current];
      if (m[4] !== undefined) {
        runs.push({ x, y, text: decodeLiteral(m[4]), font: font ? font.name : '?' });
        continue;
      }
      const hex = (m[5] || '').replace(/\s/g, '');
      let text = '';
      for (let i = 0; i + 3 < hex.length + 1; i += 4) {
        const glyph = parseInt(hex.slice(i, i + 4), 16);
        text += font && font.toUnicode[glyph] !== undefined ? font.toUnicode[glyph] : '�';
      }
      runs.push({ x, y, text, font: font ? font.name : '?' });
    }
    return runs;
  });

  return { pages, raw };
}

/** Le texte tel qu'un `pdftotext` le rendrait : une ligne par run, un saut de page entre pages. */
export function readPdfText(buffer: Buffer): string {
  return readPdfRuns(buffer).pages.map((runs) => runs.map((r) => r.text).join('\n')).join('\n\f\n');
}
