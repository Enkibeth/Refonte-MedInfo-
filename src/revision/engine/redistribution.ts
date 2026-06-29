/**
 * Recalcul du plan après avancement / report — module PUR (ADR-0027).
 *
 * À chaque tâche cochée (faite) ou reportée, on retranche le travail accompli et on
 * REDISTRIBUE le reliquat sur les jours encore disponibles à partir d'aujourd'hui. Le
 * retard fait monter la charge quotidienne : la jauge de risque le reflète honnêtement.
 *
 * Testé dans tests/unit/revision-planner.test.ts.
 */
import type { PlanInput, PlanResult } from '@/revision/types';
import {
  aggregateDailyLoads,
  bucketsFromResources,
  distribute,
  targetForMode,
  usableStudyDays,
  type WorkBucket,
} from '@/revision/engine/planner';
import { assessRisk } from '@/revision/engine/riskScoring';

const EPSILON = 1e-6;

export interface RedistributeOptions {
  /** Minutes déjà accomplies, par `resourceId`. */
  completedMinutesByResource?: Record<string, number>;
  /** Jour de référence (ISO `YYYY-MM-DD`). Par défaut : début du plan. */
  today?: string;
  /** Retard relatif optionnel (0–1) à reporter dans le score de risque. */
  latenessRatio?: number;
}

/**
 * Reconstruit un `PlanResult` en tenant compte du travail déjà fait.
 * Le buffer reste réparti par ressource (cohérent avec `planRevision`).
 */
export function redistribute(input: PlanInput, options: RedistributeOptions = {}): PlanResult {
  const { completedMinutesByResource = {}, today, latenessRatio } = options;

  const originalBuckets = bucketsFromResources(input);
  const originalTotal = originalBuckets.reduce((sum, b) => sum + b.minutes, 0);

  // Reliquat par ressource = charge initiale (buffer inclus) - minutes faites, borné à 0.
  const remainingBuckets: WorkBucket[] = originalBuckets
    .map((b) => {
      const done = Math.max(0, completedMinutesByResource[b.resourceId] ?? 0);
      return { ...b, minutes: Math.max(0, b.minutes - done) };
    })
    .filter((b) => b.minutes > EPSILON);

  const remainingTotal = remainingBuckets.reduce((sum, b) => sum + b.minutes, 0);
  const doneTotal = Math.min(originalTotal, Math.max(0, originalTotal - remainingTotal));

  const days = usableStudyDays(input, today);
  const target = targetForMode(
    input.distributionMode ?? 'smooth',
    remainingTotal,
    days.length,
    input.dailyMaxMinutes,
  );
  const tasks = distribute(remainingBuckets, days, target);
  const dailyLoads = aggregateDailyLoads(tasks, days, input.dailyMaxMinutes);
  const risk = assessRisk({
    totalMinutes: remainingTotal,
    usableDays: days.length,
    dailyMaxMinutes: input.dailyMaxMinutes,
    latenessRatio,
  });

  return {
    tasks,
    dailyLoads,
    totalWorkloadMinutes: originalTotal,
    remainingWorkloadMinutes: remainingTotal,
    usableDaysCount: days.length,
    dailyAverageMinutes: risk.dailyAverageMinutes,
    progressPercent: originalTotal > 0 ? Math.min(100, (doneTotal / originalTotal) * 100) : 0,
    risk,
  };
}
