/**
 * Tri des pièces jointes du chat (2026-10, ADR-0044) — repérage SANS IA des fichiers de notes.
 *
 * Un relevé de notes de promotion contient les résultats de dizaines d'autres étudiants
 * (données de tiers, pseudonymisées au mieux). Joint au chat, il partait tel quel au modèle
 * (un .csv est inliné en texte). L'outil Partiels fait le même travail sur l'appareil, sans
 * IA et sans réseau (ADR-0035) : le chat repère ces fichiers AVANT tout envoi et les lui
 * confie.
 *
 * Verdicts :
 *   - `spreadsheet`    : .xlsx/.xls/.ods — le chat ne lit pas les tableurs ; relais vers Partiels ;
 *   - `grade-table`    : texte tabulaire (.csv/.tsv/.txt) qui a la forme d'un relevé de notes —
 *                        jamais envoyé au modèle ;
 *   - `grade-pdf-name` : PDF dont le NOM évoque des résultats (son contenu n'est pas lisible ici
 *                        sans charger pdf.js) — simple suggestion, l'utilisateur choisit ;
 *   - `other`          : pièce jointe ordinaire.
 *
 * Heuristique volontairement SPÉCIFIQUE : un faux positif coûte un copier-coller, un faux
 * négatif envoie les notes d'une promo à l'IA ; mais un export de bilans biologiques (dates +
 * valeurs) ne doit pas être pris pour des notes. D'où des en-têtes caractéristiques exigés,
 * ou, sans en-tête, une forme très marquée (identifiants distincts + plusieurs colonnes /20).
 *
 * ⚠️ Module PUR (aucune dépendance navigateur) : tests/unit/chat-grade-sheet.test.ts.
 */

export type ChatFileVerdict = 'spreadsheet' | 'grade-table' | 'grade-pdf-name' | 'other';

/** Octets lus au plus pour reconnaître un fichier texte (le début suffit). */
export const GRADE_SNIFF_BYTES = 64 * 1024;

const SPREADSHEET_EXT = /\.(xlsx|xlsm|xls|ods)$/i;
const SPREADSHEET_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel.sheet.macroenabled.12',
  'application/vnd.ms-excel',
  'application/vnd.oasis.opendocument.spreadsheet',
]);
const TEXT_EXT = /\.(csv|tsv|txt)$/i;
const TEXT_TYPES = new Set(['text/csv', 'text/plain', 'text/tab-separated-values']);

/** Mots d'en-tête propres aux relevés de notes (accents optionnels : le décodage peut les perdre). */
const STRONG_HEADER =
  /moyenne|\brang\b|classement|matricule|anonymat|tudiant|partiel|examen|preuve|coef|\bects\b|admis|ajourn|\bue\s?\d+|\bue\b|semestre|\bjury\b/i;
/** « Note » seul est trop courant (colonne de commentaires) : il faut alors plusieurs colonnes /20. */
const WEAK_HEADER = /\bnotes?\b/i;
/** Valeurs d'absence fréquentes dans les relevés (jamais comptées comme note ni comme texte). */
const ABSENCE = /^(abs|abj|absent|def|dispense|disp|exc|nc|-|\/)$/i;
/**
 * Nom de PDF qui évoque des résultats d'examen universitaire. « Résultats » seul n'en est pas
 * un (« resultats_biologie.pdf ») : il faut un marqueur de cursus à côté.
 */
const RESULT_PDF_NAME =
  /partiel|classement|\brang\b|d[ée]lib[ée]ration|relev[ée] de notes|\bnotes?\b|\bjury\b|\bpv\b|admis|\bue\s?\d|semestre|promo|dfasm|dfgsm|\bedn\b|r[ée]sultats?\b.*\b(s\d{1,2}|session)\b|\b(s\d{1,2}|session)\b.*r[ée]sultats?/i;

const DELIMITERS = [';', '\t', ','] as const;

export function isSpreadsheetFile(name: string, mediaType: string): boolean {
  return SPREADSHEET_EXT.test(name) || SPREADSHEET_TYPES.has(mediaType.toLowerCase());
}

/** Fichier texte dont on lit le début pour le reconnaître. */
export function isSniffableTextFile(name: string, mediaType: string): boolean {
  return TEXT_EXT.test(name) || TEXT_TYPES.has(mediaType.toLowerCase());
}

function nonEmptyLines(text: string, max: number): string[] {
  return text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
    .slice(0, max);
}

/** Découpe une ligne (guillemets CSV simples gérés : `"Dupont; Jean";12`). */
function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (ch === delimiter && !quoted) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

/** Séparateur dominant : celui qui donne le même nombre (≥ 2) de colonnes sur ≥ 80 % des lignes. */
function detectTable(lines: string[]): string[][] | null {
  for (const delimiter of DELIMITERS) {
    const rows = lines.map((l) => splitLine(l, delimiter));
    const counts = new Map<number, number>();
    for (const r of rows) counts.set(r.length, (counts.get(r.length) ?? 0) + 1);
    let mode = 0;
    let modeCount = 0;
    for (const [len, n] of counts) {
      if (n > modeCount || (n === modeCount && len > mode)) {
        mode = len;
        modeCount = n;
      }
    }
    if (mode >= 2 && modeCount / rows.length >= 0.8) return rows.filter((r) => r.length === mode);
  }
  return null;
}

/** Nombre au format français ou anglais (« 12,5 », « 12.5 »), sinon NaN. */
function toNumber(cell: string): number {
  const t = cell.replace(/\s/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(t)) return NaN;
  return Number(t);
}

/** La colonne a-t-elle la forme d'une note sur 20 (≥ 70 % des valeurs renseignées dans [0, 20]) ? */
function isGradeColumn(values: string[]): boolean {
  const filled = values.filter((v) => v !== '' && !ABSENCE.test(v));
  if (filled.length < 3) return false;
  const grades = filled.filter((v) => {
    const n = toNumber(v);
    return Number.isFinite(n) && n >= 0 && n <= 20;
  });
  return grades.length / filled.length >= 0.7;
}

/** Colonne d'identifiants : valeurs distinctes (≥ 90 %), et pas une colonne de notes. */
function isIdColumn(values: string[]): boolean {
  const filled = values.filter((v) => v !== '');
  if (filled.length < values.length * 0.9) return false;
  return new Set(filled).size >= values.length * 0.9 && !isGradeColumn(values);
}

/** Une ligne est-elle un en-tête (au moins une cellule non numérique et non vide) ? */
function isHeaderRow(row: string[]): boolean {
  return row.some((c) => c !== '' && Number.isNaN(toNumber(c)) && !ABSENCE.test(c));
}

/**
 * Le texte a-t-il la forme d'un relevé de notes d'une promotion ? Renvoie le nombre de
 * lignes de données reconnues, ou null.
 */
export function looksLikeGradeTable(text: string): { rows: number } | null {
  const lines = nonEmptyLines(text, 400);
  if (lines.length < 6) return null;
  const table = detectTable(lines);
  if (!table || table.length < 6) return null;

  const hasHeader = isHeaderRow(table[0]);
  const data = hasHeader ? table.slice(1) : table;
  const columns = table[0].map((_, col) => data.map((r) => r[col] ?? ''));
  const gradeColumns = columns.filter(isGradeColumn).length;
  if (gradeColumns === 0) return null;

  if (hasHeader) {
    const header = table[0].join(' ');
    const strong = STRONG_HEADER.test(header);
    const weak = WEAK_HEADER.test(header);
    if (data.length >= 5 && (strong || (weak && gradeColumns >= 2))) return { rows: data.length };
    return null;
  }
  // Sans en-tête : forme très marquée seulement (promo entière, identifiants, plusieurs notes).
  if (data.length >= 15 && gradeColumns >= 2 && columns.some(isIdColumn)) return { rows: data.length };
  return null;
}

/**
 * Verdict sur un fichier choisi dans le chat. `textSample` : début du fichier décodé, pour
 * les fichiers texte (sans lui, un fichier texte reste `other`).
 */
export function classifyChatFile(input: {
  name: string;
  mediaType: string;
  textSample?: string | null;
}): ChatFileVerdict {
  const name = input.name || '';
  const mediaType = (input.mediaType || '').toLowerCase();
  if (isSpreadsheetFile(name, mediaType)) return 'spreadsheet';
  if (isSniffableTextFile(name, mediaType) && input.textSample) {
    return looksLikeGradeTable(input.textSample) ? 'grade-table' : 'other';
  }
  if ((mediaType === 'application/pdf' || /\.pdf$/i.test(name)) && RESULT_PDF_NAME.test(name.replace(/[_.-]+/g, ' '))) {
    return 'grade-pdf-name';
  }
  return 'other';
}
