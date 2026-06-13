/**
 * Aide au calcul de dates pour le planificateur — PUR, sans dépendance ni fuseau.
 *
 * Toutes les dates sont des chaînes ISO `yyyy-mm-dd` interprétées en UTC à midi
 * (évite les bascules de jour liées aux fuseaux). Aucune donnée de santé.
 */

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Vrai si `value` est une date ISO `yyyy-mm-dd` valide. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_RE.test(value)) return false;
  const t = Date.parse(`${value}T12:00:00Z`);
  return Number.isFinite(t);
}

function toUtc(date: string): number {
  return Date.parse(`${date}T12:00:00Z`);
}

const DAY_MS = 86_400_000;

/** Jour de la semaine (0 = dimanche … 6 = samedi) d'une date ISO. */
export function weekdayOf(date: string): number {
  return new Date(toUtc(date)).getUTCDay();
}

/** Nombre de jours entiers de `from` (inclus) à `to` (exclus). Négatif si `to < from`. */
export function diffDays(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

/** Ajoute `n` jours à une date ISO et renvoie une date ISO. */
export function addDays(date: string, n: number): string {
  return new Date(toUtc(date) + n * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Liste les dates ISO de `start` (inclus) à `endExclusive` (exclu).
 * Renvoie `[]` si l'intervalle est vide ou inversé. Borné pour éviter les boucles
 * accidentelles sur des fenêtres absurdes (max 5 ans).
 */
export function eachDay(start: string, endExclusive: string): string[] {
  const span = diffDays(start, endExclusive);
  if (span <= 0) return [];
  const out: string[] = [];
  for (let i = 0; i < Math.min(span, 1830); i += 1) out.push(addDays(start, i));
  return out;
}
