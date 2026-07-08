/**
 * Modèle pur du dashboard ECOS : statistiques globales, résumé des passages
 * par cas, groupement par thème (spécialité) et filtres (recherche / thème /
 * statut fait-à faire).
 *
 * Aucune dépendance UI ni DB — consommé par app/(chat)/ecos.tsx, testé dans
 * tests/unit/ecos-dashboard.test.ts.
 */

/** Passage minimal pour les calculs (projection d'une ligne `ecos_attempts`). */
export interface AttemptLite {
  caseSlug: string;
  score: number | null;
  createdAt: string; // ISO 8601
}

export interface EcosStats {
  /** Cas publiés disponibles. */
  casesAvailable: number;
  /** Nombre total de passages (toutes tentatives confondues). */
  attemptsCount: number;
  /** Cas distincts déjà passés parmi les cas disponibles. */
  casesAttempted: number;
  /** Moyenne des notes connues, arrondie à 0,1 (null si aucune note). */
  averageScore: number | null;
  /** Meilleure note tous cas confondus (null si aucune note). */
  bestScore: number | null;
}

export function computeEcosStats(caseSlugs: string[], attempts: AttemptLite[]): EcosStats {
  const available = new Set(caseSlugs);
  const attempted = new Set<string>();
  let sum = 0;
  let scored = 0;
  let best: number | null = null;

  for (const attempt of attempts) {
    if (available.has(attempt.caseSlug)) attempted.add(attempt.caseSlug);
    if (typeof attempt.score === 'number') {
      sum += attempt.score;
      scored += 1;
      if (best === null || attempt.score > best) best = attempt.score;
    }
  }

  return {
    casesAvailable: available.size,
    attemptsCount: attempts.length,
    casesAttempted: attempted.size,
    averageScore: scored > 0 ? Math.round((sum / scored) * 10) / 10 : null,
    bestScore: best,
  };
}

/** Résumé des passages d'UN cas (pour l'afficher directement sur sa carte). */
export interface CaseAttemptSummary {
  attempts: number;
  best: number | null;
  /** Note du passage le plus récent (peut être null si non extraite). */
  last: number | null;
  lastAt: string | null;
}

/** Résumés par slug de cas — indépendant de l'ordre du tableau d'entrée. */
export function summarizeAttemptsByCase(attempts: AttemptLite[]): Map<string, CaseAttemptSummary> {
  const map = new Map<string, CaseAttemptSummary>();
  for (const attempt of attempts) {
    const current =
      map.get(attempt.caseSlug) ?? { attempts: 0, best: null, last: null, lastAt: null };
    current.attempts += 1;
    if (typeof attempt.score === 'number' && (current.best === null || attempt.score > current.best)) {
      current.best = attempt.score;
    }
    // Comparaison lexicographique valide sur des timestamps ISO.
    if (current.lastAt === null || attempt.createdAt > current.lastAt) {
      current.last = attempt.score;
      current.lastAt = attempt.createdAt;
    }
    map.set(attempt.caseSlug, current);
  }
  return map;
}

export type StatusFilter = 'all' | 'todo' | 'done';

export interface DashboardFilters {
  query: string;
  /** Thème (spécialité) sélectionné — null = tous. */
  theme: string | null;
  status: StatusFilter;
}

export interface FilterableCase {
  id: string;
  titre: string;
  specialite: string;
  consigneCandidat: string;
}

export function filterCases<T extends FilterableCase>(
  cases: T[],
  filters: DashboardFilters,
  summaries: Map<string, CaseAttemptSummary>,
): T[] {
  const query = filters.query.trim().toLowerCase();
  return cases.filter((c) => {
    if (filters.theme && themeOf(c) !== filters.theme) return false;
    const done = (summaries.get(c.id)?.attempts ?? 0) > 0;
    if (filters.status === 'todo' && done) return false;
    if (filters.status === 'done' && !done) return false;
    if (query) {
      const haystack = `${c.titre} ${c.specialite} ${c.consigneCandidat}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

function themeOf(c: { specialite: string }): string {
  return c.specialite.trim() || 'Autre';
}

/** Groupe les cas par thème (spécialité), thèmes triés alphabétiquement (fr). */
export function groupCasesByTheme<T extends { specialite: string }>(
  cases: T[],
): { theme: string; cases: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const c of cases) {
    const theme = themeOf(c);
    const list = groups.get(theme);
    if (list) list.push(c);
    else groups.set(theme, [c]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'fr'))
    .map(([theme, list]) => ({ theme, cases: list }));
}

/** Thèmes distincts (pour la rangée de filtres), triés alphabétiquement (fr). */
export function listThemes(cases: { specialite: string }[]): string[] {
  return groupCasesByTheme(cases).map((group) => group.theme);
}
