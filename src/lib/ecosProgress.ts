/**
 * Suivi de progression ECOS — logique PURE (sans I/O réseau ni stockage), testée
 * dans tests/unit/ecos-progress.test.ts.
 *
 * Les sessions ECOS portent sur des cas FICTIFS (ADR-0017) : ce ne sont PAS des
 * données de santé. La persistance reste locale à l'appareil (src/lib/ecosStore.ts).
 */

export interface EcosSession {
  /** Slug / id du cas joué (cas du corpus ou cas importé éphémère). */
  caseId: string;
  caseTitle: string;
  specialty: string;
  /** Note extraite de l'évaluation, sur 20 (null si non parsable). */
  score: number | null;
  /** ISO date de fin de simulation. */
  date: string;
}

export interface EcosProgress {
  /** Nombre total de simulations terminées. */
  total: number;
  /** Combien ont une note exploitable. */
  scored: number;
  averageOn20: number | null;
  bestOn20: number | null;
  lastDate: string | null;
}

/**
 * Extrait une note /20 depuis le markdown d'évaluation de l'examinateur.
 * Tolère « 14/20 », « 14 / 20 », « Note : 14,5/20 », « note estimée : 12 sur 20 ».
 * Renvoie null si rien d'exploitable. Valeur clampée à [0, 20], arrondie au dixième.
 */
export function parseEcosScore(markdown: string): number | null {
  if (!markdown) return null;
  // Décimales françaises « 14,5 » → « 14.5 » (uniquement entre deux chiffres).
  const norm = markdown.replace(/(\d),(\d)/g, '$1.$2');
  const re = /(\d{1,2}(?:\.\d{1,2})?)\s*(?:\/|sur)\s*20\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(norm)) !== null) {
    const val = Number(m[1]);
    if (Number.isFinite(val) && val >= 0 && val <= 20) {
      return Math.round(val * 10) / 10;
    }
  }
  return null;
}

/** Agrège une liste de sessions en indicateurs de progression. */
export function computeProgress(sessions: EcosSession[]): EcosProgress {
  const total = sessions.length;
  const scores = sessions
    .map((s) => s.score)
    .filter((s): s is number => s != null && Number.isFinite(s));
  const scored = scores.length;
  const averageOn20 = scored
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scored) * 10) / 10
    : null;
  const bestOn20 = scored ? Math.max(...scores) : null;
  const lastDate = sessions.reduce<string | null>(
    (acc, s) => (acc && acc >= s.date ? acc : s.date),
    null,
  );
  return { total, scored, averageOn20, bestOn20, lastDate };
}

/** Dernière note connue par cas (pour afficher un rappel sur les cartes). */
export function lastScoreByCase(sessions: EcosSession[]): Record<string, number | null> {
  // Les sessions sont supposées triées récent → ancien ; on garde la 1re vue par cas.
  const out: Record<string, number | null> = {};
  for (const s of sessions) {
    if (!(s.caseId in out)) out[s.caseId] = s.score;
  }
  return out;
}
