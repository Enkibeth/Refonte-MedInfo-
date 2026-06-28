/**
 * Dashboard de révision étudiant — types du domaine (MVP, ADR-0027).
 *
 * ⚠️ Domaine PUR et pédagogique : volumes de travail, planning, progression d'étude.
 * Jamais de symptôme, de cas patient, de diagnostic ni de donnée de santé (safe-box
 * non-MDSW). La « maîtrise » d'un chapitre = confiance d'étude d'un support, pas un
 * état de santé.
 */

/** Type d'examen ciblé (sert seulement de préréglage / libellé). */
export type ExamType = 'pass_las' | 'dfgsm' | 'edn' | 'ecos' | 'custom';

/** Nature d'une tâche planifiée (dérivée du volume dominant d'une ressource). */
export type TaskType = 'reading' | 'chapters' | 'qcm' | 'review' | 'custom';

export type TaskStatus = 'pending' | 'done' | 'deferred';

/** Niveau de risque du plan (jauge anti-panique vert / orange / rouge). */
export type RiskLevel = 'green' | 'orange' | 'red';

/** Rythme personnel de l'étudiant (jamais inventé par l'IA — saisi par l'utilisateur). */
export interface SpeedProfile {
  pagesPerHour: number;
  chaptersPerHour: number;
  qcmPerHour: number;
}

/** Bloc de travail à réviser (volumes RESTANTS). */
export interface RevisionResource {
  id: string;
  title: string;
  /** Pages restant à lire. */
  pages: number;
  /** Chapitres restant à traiter. */
  chapters: number;
  /** QCM restant à faire. */
  qcm: number;
  /** Priorité : 1 = la plus haute (traitée en premier). */
  priority: number;
}

/** Entrée complète du moteur de planification (déterministe). */
export interface PlanInput {
  /** Date de début (ISO `YYYY-MM-DD`). */
  startDate: string;
  /** Date d'examen (ISO `YYYY-MM-DD`) — jour NON travaillé. */
  examDate: string;
  /** Jours indisponibles, exclus du planning (ISO `YYYY-MM-DD`). */
  unavailableDays: string[];
  /** Temps de travail maximum par jour (minutes). */
  dailyMaxMinutes: number;
  /** Marge de sécurité ajoutée à la charge (0.1 = +10 %). */
  bufferRatio: number;
  resources: RevisionResource[];
  speed: SpeedProfile;
}

/** Une tâche placée à une date précise. */
export interface PlannedTask {
  date: string;
  resourceId: string;
  title: string;
  taskType: TaskType;
  minutes: number;
}

/** Charge agrégée d'une journée. */
export interface DailyLoad {
  date: string;
  minutes: number;
  /** La journée dépasse `dailyMaxMinutes` (signal de surcharge). */
  overCapacity: boolean;
}

/** Évaluation du risque global du plan. */
export interface RiskAssessment {
  level: RiskLevel;
  /** Charge quotidienne moyenne nécessaire ÷ capacité quotidienne. */
  capacityRatio: number;
  dailyAverageMinutes: number;
  reason: string;
}

/** Résultat complet d'une planification. */
export interface PlanResult {
  tasks: PlannedTask[];
  dailyLoads: DailyLoad[];
  /** Charge totale (buffer inclus), minutes. */
  totalWorkloadMinutes: number;
  /** Charge restante (buffer inclus), minutes. */
  remainingWorkloadMinutes: number;
  usableDaysCount: number;
  dailyAverageMinutes: number;
  /** 0–100. */
  progressPercent: number;
  risk: RiskAssessment;
}
