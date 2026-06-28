/**
 * Utilitaires de dates du planificateur de révision — module PUR (UTC, sans timezone).
 *
 * Les dates sont des chaînes ISO `YYYY-MM-DD`. Tout est calculé en UTC pour rester
 * déterministe quel que soit le fuseau de l'appareil (testé dans
 * tests/unit/revision-planner.test.ts).
 */

const MS_PER_DAY = 86_400_000;

/** ISO `YYYY-MM-DD` → millisecondes UTC à minuit. */
export function parseISODate(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Millisecondes UTC → ISO `YYYY-MM-DD`. */
export function toISODate(ms: number): string {
  const dt = new Date(ms);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Jours pleins entre deux dates (>= 0). `b` - `a`, arrondi vers le bas. */
export function daysBetween(aISO: string, bISO: string): number {
  return Math.max(0, Math.round((parseISODate(bISO) - parseISODate(aISO)) / MS_PER_DAY));
}

/** Liste des jours [startISO, endExclusiveISO[ (le dernier jour n'est PAS inclus). */
export function enumerateDays(startISO: string, endExclusiveISO: string): string[] {
  const out: string[] = [];
  const end = parseISODate(endExclusiveISO);
  for (let cur = parseISODate(startISO); cur < end; cur += MS_PER_DAY) {
    out.push(toISODate(cur));
  }
  return out;
}

/** Le plus tardif de deux jours ISO. */
export function maxISODate(aISO: string, bISO: string): string {
  return parseISODate(aISO) >= parseISODate(bISO) ? aISO : bISO;
}
