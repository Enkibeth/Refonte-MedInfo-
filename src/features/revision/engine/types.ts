/**
 * Modèle de domaine du planificateur de révisions (feature étudiant, ADR-0027).
 *
 * ⚠️ Périmètre réglementaire (safe-box non-MDSW) : ce module ne manipule QUE des
 * données pédagogiques et d'organisation du travail (volumes, dates, rythme,
 * progression d'apprentissage). Jamais de symptôme, de cas patient, de diagnostic,
 * de conduite à tenir ni de donnée de santé personnelle. Voir docs/01_REGULATION.md.
 *
 * Le cœur est un moteur DÉTERMINISTE (aucun appel IA, aucun réseau) : tout chiffre
 * vient de l'utilisateur ou d'un calcul explicite et reproductible.
 */

/** Type de concours / cursus visé (sert d'étiquette UX, pas de logique cachée). */
export type ExamType = 'pass_las' | 'dfgsm' | 'edn' | 'ecos' | 'custom';

/** Vitesse personnelle déclarée par l'étudiant (jamais inventée par l'app). */
export interface SpeedProfile {
  /** Pages lues/révisées par heure. */
  pagesPerHour: number;
  /** Chapitres traités par heure. */
  chaptersPerHour: number;
  /** QCM faits par heure. */
  qcmPerHour: number;
}

/**
 * Un bloc de travail : une matière / un collège / un chapitre avec ses volumes.
 * Les compteurs `completed*` portent la progression réelle (ce qui est coché « fait »).
 */
export interface RevisionItem {
  id: string;
  title: string;
  /** Matière ou collège (étiquette libre). */
  subject?: string;
  pages: number;
  chapters: number;
  qcm: number;
  /** 1 = priorité haute, 2 = normale, 3 = basse (planifié dans cet ordre). */
  priority: number;
  completedPages: number;
  completedChapters: number;
  completedQcm: number;
}

/** Fenêtre temporelle et capacité quotidienne. */
export interface PlanWindow {
  /** Début de la période (ISO `yyyy-mm-dd`). */
  startDate: string;
  /** Date de l'examen (ISO `yyyy-mm-dd`) — non travaillée. */
  examDate: string;
  /** Jours entièrement indisponibles (dates ISO exactes). */
  unavailableDays: string[];
  /** Jours de repos hebdomadaires récurrents (0 = dimanche … 6 = samedi). */
  restWeekdays: number[];
  /** Plafond de travail par jour, en minutes. */
  dailyMaxMinutes: number;
}

export interface PlannerInput {
  /** Date de référence « aujourd'hui » (ISO) pour le calcul du restant. */
  today: string;
  window: PlanWindow;
  speed: SpeedProfile;
  items: RevisionItem[];
  /** Part des jours utilisables réservée en tampon final (0–0.5). */
  bufferRatio: number;
  /** Active des sessions de rappel actif sur les jours tampon. */
  spacedRepetition?: boolean;
}

export type TaskKind = 'study' | 'review';

/** Une tâche planifiée pour un jour donné (dérivée, jamais figée en base). */
export interface PlannedTask {
  date: string;
  itemId: string;
  title: string;
  kind: TaskKind;
  minutes: number;
  pages: number;
  chapters: number;
  qcm: number;
}

/** Charge d'un jour (tâches + total minutes). */
export interface DayLoad {
  date: string;
  weekday: number;
  minutes: number;
  tasks: PlannedTask[];
  /** Jour tampon réservé (pas de nouveau contenu, rappel actif éventuel). */
  buffer: boolean;
}

export type RiskLevel = 'green' | 'orange' | 'red';

export interface RiskAssessment {
  level: RiskLevel;
  /** Charge quotidienne moyenne / plafond quotidien. */
  loadRatio: number;
  /** Raison lisible (FR) — affichée telle quelle, jamais un conseil médical. */
  reason: string;
}

export interface PlannerResult {
  tasks: PlannedTask[];
  byDay: DayLoad[];
  /** Jours utilisables totaux (hors examen, repos, indispo). */
  usableDays: number;
  /** Jours réellement planifiables (utilisables − tampon). */
  schedulingDays: number;
  /** Jours réservés en tampon final. */
  bufferDays: number;
  totalRemainingMinutes: number;
  totalPlannedMinutes: number;
  dailyAverageMinutes: number;
  weeklyAverageMinutes: number;
  /** Minutes de travail qui ne tiennent pas avant l'examen (> 0 ⇒ plan irréaliste). */
  overflowMinutes: number;
  /** Progression globale 0–100 (minutes faites / minutes totales). */
  progressPercent: number;
  daysUntilExam: number;
  risk: RiskAssessment;
}
