/**
 * Note d'une évaluation ECOS — extraction et présentation DÉTERMINISTES.
 *
 * L'évaluation IA (feature `ecos_evaluate`) rend un markdown dont la section
 * « Résultat global » commence par « **Note : X/20** ». On extrait la première
 * fraction « x/20 » de façon tolérante (décimales point/virgule, espaces) :
 * si aucune note fiable n'est trouvée, on renvoie null — jamais de chiffre inventé.
 *
 * Module pur (aucune dépendance UI/DB) — testé dans tests/unit/ecos-dashboard.test.ts.
 */

/** Barème d'une station ECOS (note sur 20). */
export const ECOS_SCORE_MAX = 20;

/** Première fraction « x/20 » du markdown (14/20, 14,5/20, 14.5 / 20…), sinon null. */
export function parseScoreFromEvaluation(markdown: string): number | null {
  if (!markdown) return null;
  const match = markdown.match(/(\d{1,2}(?:[.,]\d{1,2})?)\s*\/\s*20\b/);
  if (!match) return null;
  const value = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(value) || value < 0 || value > ECOS_SCORE_MAX) return null;
  return Math.round(value * 10) / 10;
}

export type ScoreTone = 'success' | 'warning' | 'danger';

/** Barème couleur : ≥ 14 vert (bien), 10–13,9 ambre (passable), < 10 rouge (insuffisant). */
export function scoreTone(score: number): ScoreTone {
  if (score >= 14) return 'success';
  if (score >= 10) return 'warning';
  return 'danger';
}

/** « 14 » ou « 14,5 » — virgule décimale française, pas de décimale inutile. */
export function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1).replace('.', ',');
}
