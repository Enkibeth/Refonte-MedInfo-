/**
 * Analyseur de classement de promo — logique PURE (testable, sans réseau, sans IA).
 *
 * Concept (medoutils) : on importe le tableau des notes de toute la promo (CSV/TSV exporté
 * d'Excel/Sheets, ou collé), et on calcule son rang + des statistiques, avec comparaison
 * possible à un autre numéro étudiant. Tout se fait en mémoire : aucune donnée n'est envoyée.
 */

export interface Sheet {
  headers: string[];
  rows: string[][];
}

/** Détecte le séparateur le plus probable d'un texte tabulaire (FR Excel = ';'). */
export function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const counts: Record<string, number> = {
    ';': (firstLine.match(/;/g) || []).length,
    '\t': (firstLine.match(/\t/g) || []).length,
    ',': (firstLine.match(/,/g) || []).length,
  };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

/** Parse un CSV/TSV (gère les champs entre guillemets et les guillemets échappés ""). */
export function parseDelimited(text: string, delimiter = detectDelimiter(text)): Sheet {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      pushField();
    } else if (c === '\n') {
      pushRow();
    } else if (c === '\r') {
      /* ignore (CRLF) */
    } else field += c;
  }
  if (field.length > 0 || row.length > 0) pushRow();

  const nonEmpty = rows.filter((r) => r.some((cell) => cell.trim() !== ''));
  const headers = (nonEmpty.shift() ?? []).map((h) => h.trim());
  return { headers, rows: nonEmpty.map((r) => r.map((c) => c.trim())) };
}

/** Convertit une cellule en nombre (gère « 12,5 », « 12.5 », espaces). NaN si non numérique. */
export function toNumber(cell: string | undefined): number {
  if (cell == null) return NaN;
  const cleaned = cell.replace(/\s/g, '').replace(',', '.');
  if (cleaned === '') return NaN;
  return Number(cleaned);
}

const ID_HEADER = /num|étud|etud|matricule|\bine\b|\bid\b|inscription|anonym/i;
const GRADE_HEADER = /moyenne|total|note|résultat|resultat|score|points?/i;

/** Détecte la colonne identifiant (n° étudiant) et les colonnes de notes numériques. */
export function detectColumns(sheet: Sheet): { idCol: number; gradeCols: number[] } {
  const { headers, rows } = sheet;
  const colCount = headers.length;

  const numericRatio = (col: number): number => {
    if (rows.length === 0) return 0;
    let n = 0;
    for (const r of rows) if (!Number.isNaN(toNumber(r[col]))) n++;
    return n / rows.length;
  };
  const uniqueRatio = (col: number): number => {
    const seen = new Set(rows.map((r) => (r[col] ?? '').trim()).filter(Boolean));
    return rows.length ? seen.size / rows.length : 0;
  };

  const gradeCols: number[] = [];
  for (let c = 0; c < colCount; c++) {
    if (numericRatio(c) >= 0.6) gradeCols.push(c);
  }

  // idCol : header explicite, sinon colonne très unique (souvent numérique longue), sinon 0.
  let idCol = headers.findIndex((h) => ID_HEADER.test(h));
  if (idCol < 0) {
    let best = -1;
    let bestScore = 0.85; // seuil d'unicité
    for (let c = 0; c < colCount; c++) {
      const u = uniqueRatio(c);
      if (u >= bestScore) {
        bestScore = u;
        best = c;
      }
    }
    idCol = best >= 0 ? best : 0;
  }

  return { idCol, gradeCols: gradeCols.filter((c) => c !== idCol) };
}

/** Choisit la colonne de note par défaut (header « moyenne/total/note », sinon la 1re). */
export function defaultGradeCol(sheet: Sheet, gradeCols: number[]): number {
  const named = gradeCols.find((c) => GRADE_HEADER.test(sheet.headers[c] ?? ''));
  return named ?? gradeCols[0] ?? -1;
}

export interface Ranking {
  total: number;
  rank: number; // 1 = meilleur ; rang de compétition (ex æquo partagent le rang)
  score: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  /** % de la promo strictement en-dessous de moi. */
  betterThanPct: number;
}

/** Classe `score` parmi `values` (toutes les notes de la colonne). */
export function rankWithin(values: number[], score: number): Ranking | null {
  const clean = values.filter((v) => !Number.isNaN(v)).sort((a, b) => a - b);
  const total = clean.length;
  if (total === 0 || Number.isNaN(score)) return null;

  const higher = clean.filter((v) => v > score).length;
  const below = clean.filter((v) => v < score).length;
  const mid = Math.floor(total / 2);
  const median = total % 2 ? clean[mid] : (clean[mid - 1] + clean[mid]) / 2;

  return {
    total,
    rank: higher + 1,
    score,
    mean: clean.reduce((s, v) => s + v, 0) / total,
    median,
    min: clean[0],
    max: clean[total - 1],
    betterThanPct: total > 1 ? (below / total) * 100 : 0,
  };
}

/** Trouve l'index de ligne d'un étudiant par son identifiant (comparaison souple). */
export function findRow(sheet: Sheet, idCol: number, studentId: string): number {
  const target = studentId.trim().toLowerCase();
  if (!target) return -1;
  return sheet.rows.findIndex((r) => (r[idCol] ?? '').trim().toLowerCase() === target);
}

export interface StudentResult {
  id: string;
  ranking: Ranking;
}

export interface AnalyzeResult {
  me: StudentResult | null;
  other: StudentResult | null;
  /** Écart de note moi − autre (positif = je suis devant). */
  gap: number | null;
  error?: string;
}

/** Analyse complète : mon classement + comparaison optionnelle à un autre numéro. */
export function analyze(
  sheet: Sheet,
  idCol: number,
  gradeCol: number,
  myId: string,
  otherId?: string,
): AnalyzeResult {
  if (gradeCol < 0) return { me: null, other: null, gap: null, error: 'Aucune colonne de notes détectée.' };
  const values = sheet.rows.map((r) => toNumber(r[gradeCol]));

  const build = (id: string): StudentResult | { error: string } => {
    const idx = findRow(sheet, idCol, id);
    if (idx < 0) return { error: `Numéro « ${id} » introuvable dans le fichier.` };
    const ranking = rankWithin(values, toNumber(sheet.rows[idx][gradeCol]));
    if (!ranking) return { error: `Pas de note exploitable pour « ${id} ».` };
    return { id: id.trim(), ranking };
  };

  const meRes = build(myId);
  if ('error' in meRes) return { me: null, other: null, gap: null, error: meRes.error };

  let other: StudentResult | null = null;
  if (otherId && otherId.trim()) {
    const o = build(otherId);
    if (!('error' in o)) other = o;
  }

  return {
    me: meRes,
    other,
    gap: other ? meRes.ranking.score - other.ranking.score : null,
  };
}
