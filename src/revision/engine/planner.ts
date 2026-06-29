/**
 * Moteur de planification de révision — déterministe, sans IA, sans réseau (ADR-0027).
 *
 * Répartit les volumes de travail (convertis en minutes par `workload.ts`) sur les jours
 * réellement disponibles, en respectant la capacité quotidienne quand c'est possible, et
 * en SURFAÇANT la surcharge plutôt qu'en la masquant. C'est le cœur de la feature ;
 * l'IA n'intervient qu'en « boost » optionnel (phase 2) et ne produit jamais ces chiffres.
 *
 * Testé dans tests/unit/revision-planner.test.ts.
 */
import type {
  DailyLoad,
  DistributionMode,
  PlanInput,
  PlanResult,
  PlannedTask,
  TaskType,
} from '@/revision/types';
import { enumerateDays, maxISODate } from '@/revision/engine/dates';
import {
  dominantTaskType,
  resourceMinutes,
  totalWorkloadMinutes,
  withBuffer,
} from '@/revision/engine/workload';
import { assessRisk } from '@/revision/engine/riskScoring';

const EPSILON = 1e-6;

/** Unité de travail prête à distribuer (charge déjà convertie en minutes). */
export interface WorkBucket {
  resourceId: string;
  title: string;
  taskType: TaskType;
  minutes: number;
  /** 1 = priorité la plus haute. */
  priority: number;
}

/**
 * Jours réellement travaillables : de max(début, aujourd'hui) jusqu'à la veille de
 * l'examen, moins les jours indisponibles. `today` permet de recalculer « à partir
 * d'aujourd'hui » (cf. redistribution).
 */
export function usableStudyDays(input: PlanInput, today?: string): string[] {
  const from = today ? maxISODate(input.startDate, today) : input.startDate;
  const unavailable = new Set(input.unavailableDays);
  return enumerateDays(from, input.examDate).filter((d) => !unavailable.has(d));
}

/**
 * Distribue les unités de travail (triées par priorité) sur les jours en LISSANT la
 * charge : chaque journée vise `targetMinutesPerDay` (typiquement charge totale ÷ jours),
 * ce qui évite de saturer le début puis de laisser des jours vides. La détection de
 * surcharge se fait ensuite en comparant la charge quotidienne à la capacité réelle
 * (`aggregateDailyLoads`). Tout reliquat de fin (dérive flottante) est empilé sur le
 * DERNIER jour — jamais supprimé en silence.
 */
export function distribute(
  buckets: WorkBucket[],
  days: string[],
  targetMinutesPerDay: number,
): PlannedTask[] {
  const tasks: PlannedTask[] = [];
  if (days.length === 0) return tasks;

  const target = targetMinutesPerDay > EPSILON ? targetMinutesPerDay : Infinity;
  const ordered = [...buckets].sort((a, b) => a.priority - b.priority);

  let dayIndex = 0;
  let dayUsed = 0;

  for (const bucket of ordered) {
    let remaining = bucket.minutes;
    while (remaining > EPSILON) {
      if (dayIndex >= days.length) {
        // Reliquat de fin (arrondi flottant) : sur le dernier jour, surcharge assumée.
        tasks.push(makeTask(days[days.length - 1], bucket, remaining));
        remaining = 0;
        break;
      }
      const available = target - dayUsed;
      if (available <= EPSILON) {
        dayIndex += 1;
        dayUsed = 0;
        continue;
      }
      const chunk = Math.min(remaining, available);
      tasks.push(makeTask(days[dayIndex], bucket, chunk));
      dayUsed += chunk;
      remaining -= chunk;
    }
  }
  return tasks;
}

/** Cible de lissage quotidienne : charge à répartir ÷ nombre de jours disponibles. */
export function smoothingTarget(totalMinutes: number, dayCount: number): number {
  return dayCount > 0 ? totalMinutes / dayCount : 0;
}

/**
 * Cible quotidienne selon le mode de répartition :
 *  - `smooth`    : charge ÷ jours (chaque jour ~identique) ;
 *  - `frontload` : capacité quotidienne (remplit les premiers jours au max, fin allégée).
 */
export function targetForMode(
  mode: DistributionMode,
  totalMinutes: number,
  dayCount: number,
  dailyMaxMinutes: number,
): number {
  return mode === 'frontload' ? dailyMaxMinutes : smoothingTarget(totalMinutes, dayCount);
}

function makeTask(date: string, bucket: WorkBucket, minutes: number): PlannedTask {
  return {
    date,
    resourceId: bucket.resourceId,
    title: bucket.title,
    taskType: bucket.taskType,
    minutes,
  };
}

/** Charge agrégée par jour (toutes les journées disponibles, même vides). */
export function aggregateDailyLoads(
  tasks: PlannedTask[],
  days: string[],
  dailyMaxMinutes: number,
): DailyLoad[] {
  const byDate = new Map<string, number>();
  for (const t of tasks) byDate.set(t.date, (byDate.get(t.date) ?? 0) + t.minutes);
  const cap = dailyMaxMinutes > 0 ? dailyMaxMinutes : Infinity;
  return days.map((date) => {
    const minutes = byDate.get(date) ?? 0;
    return { date, minutes, overCapacity: minutes > cap + EPSILON };
  });
}

/** Construit les unités de travail à partir des ressources (buffer réparti par ressource). */
export function bucketsFromResources(input: PlanInput): WorkBucket[] {
  return input.resources
    .map((r) => ({
      resourceId: r.id,
      title: r.title,
      taskType: dominantTaskType(r, input.speed),
      minutes: withBuffer(resourceMinutes(r, input.speed), input.bufferRatio),
      priority: r.priority,
    }))
    .filter((b) => b.minutes > EPSILON);
}

/**
 * Planifie un plan complet à partir de zéro (aucune tâche encore faite).
 * `today` (optionnel) borne le départ au jour courant.
 */
export function planRevision(input: PlanInput, today?: string): PlanResult {
  const days = usableStudyDays(input, today);
  const total = withBuffer(totalWorkloadMinutes(input.resources, input.speed), input.bufferRatio);
  const buckets = bucketsFromResources(input);
  const target = targetForMode(input.distributionMode ?? 'smooth', total, days.length, input.dailyMaxMinutes);
  const tasks = distribute(buckets, days, target);
  const dailyLoads = aggregateDailyLoads(tasks, days, input.dailyMaxMinutes);
  const risk = assessRisk({
    totalMinutes: total,
    usableDays: days.length,
    dailyMaxMinutes: input.dailyMaxMinutes,
  });

  return {
    tasks,
    dailyLoads,
    totalWorkloadMinutes: total,
    remainingWorkloadMinutes: total,
    usableDaysCount: days.length,
    dailyAverageMinutes: risk.dailyAverageMinutes,
    progressPercent: 0,
    risk,
  };
}
