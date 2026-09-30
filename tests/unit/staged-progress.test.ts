import { describe, it, expect } from 'vitest';

import {
  PROGRESS_CEILING,
  PROGRESS_PLANS,
  activeStepIndex,
  formatElapsed,
  isSlow,
  progressFraction,
  type ProgressPlan,
} from '@/ui/progress/stagedProgress';

const plans = Object.entries(PROGRESS_PLANS) as [string, ProgressPlan][];

describe('PROGRESS_PLANS — cohérence des plans de chargement', () => {
  it.each(plans)('%s : étapes non vides, 1re à 0 ms, seuils strictement croissants', (_key, plan) => {
    expect(plan.title.trim()).not.toBe('');
    expect(plan.steps.length).toBeGreaterThanOrEqual(2);
    expect(plan.steps[0].afterMs).toBe(0);
    for (let i = 1; i < plan.steps.length; i++) {
      expect(plan.steps[i].afterMs).toBeGreaterThan(plan.steps[i - 1].afterMs);
    }
    for (const s of plan.steps) expect(s.label.trim()).not.toBe('');
    expect(new Set(plan.steps.map((s) => s.label)).size).toBe(plan.steps.length);
    expect(plan.slowAfterMs).toBeGreaterThan(plan.steps[plan.steps.length - 1].afterMs);
  });
});

describe('activeStepIndex', () => {
  const { steps } = PROGRESS_PLANS.qcm;
  it('suit les seuils et reste sur la dernière étape', () => {
    expect(activeStepIndex(steps, -5)).toBe(0);
    expect(activeStepIndex(steps, 0)).toBe(0);
    expect(activeStepIndex(steps, steps[1].afterMs)).toBe(1);
    expect(activeStepIndex(steps, steps[1].afterMs - 1)).toBe(0);
    expect(activeStepIndex(steps, 10 * 60_000)).toBe(steps.length - 1);
  });
  it('plan vide → 0', () => {
    expect(activeStepIndex([], 1000)).toBe(0);
  });
});

describe('progressFraction — monotone, jamais pleine', () => {
  it.each(plans)('%s', (_key, plan) => {
    let prev = -1;
    for (let t = 0; t <= 10 * 60_000; t += 250) {
      const f = progressFraction(plan, t);
      expect(f).toBeGreaterThanOrEqual(prev);
      expect(f).toBeLessThanOrEqual(PROGRESS_CEILING);
      prev = f;
    }
    expect(progressFraction(plan, 0)).toBe(0);
    expect(prev).toBeLessThan(1);
  });
});

describe('formatElapsed / isSlow', () => {
  it('formate secondes puis minutes', () => {
    expect(formatElapsed(0)).toBe('0 s');
    expect(formatElapsed(8_400)).toBe('8 s');
    expect(formatElapsed(65_000)).toBe('1 min 05');
    expect(formatElapsed(-3)).toBe('0 s');
  });
  it('message de patience seulement au-delà du seuil', () => {
    const plan = PROGRESS_PLANS.analyze;
    expect(isSlow(plan, plan.slowAfterMs - 1)).toBe(false);
    expect(isSlow(plan, plan.slowAfterMs)).toBe(true);
  });
});
