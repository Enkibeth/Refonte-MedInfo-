import { describe, it, expect } from 'vitest';

import {
  sanitizeStoredPlan,
  storedPlanToInput,
  completedByResource,
  coerceExamType,
  coercePlanId,
  newResourceId,
  MAX_RESOURCES,
} from '@/revision/db/plans';
import { planRevision } from '@/revision/engine/planner';

describe('plans — sanitizeStoredPlan (bornage avant écriture RLS)', () => {
  it('remplit des défauts sûrs sur un objet vide', () => {
    const p = sanitizeStoredPlan({});
    expect(p.dailyMaxMinutes).toBe(120);
    expect(p.bufferRatio).toBeCloseTo(0.1, 5);
    expect(p.resources).toEqual([]);
    expect(p.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('rejette les dates non ISO et borne les nombres', () => {
    const p = sanitizeStoredPlan({
      startDate: 'pas-une-date',
      examDate: '2026-07-01',
      dailyMaxMinutes: 99999,
      bufferRatio: 5,
      unavailableDays: ['2026-06-10', 'nope', 42],
      resources: [{ title: '  Cardio  ', pages: -5, chapters: 3, qcm: 1.9, priority: 0, masteryStart: 9 }],
    });
    expect(p.examDate).toBe('2026-07-01');
    expect(p.dailyMaxMinutes).toBe(24 * 60);
    expect(p.bufferRatio).toBe(1);
    expect(p.unavailableDays).toEqual(['2026-06-10']);
    expect(p.resources[0].title).toBe('Cardio');
    expect(p.resources[0].pages).toBe(0); // clampé à >= 0
    expect(p.resources[0].qcm).toBe(2); // arrondi
    expect(p.resources[0].priority).toBe(1); // clampé à >= 1
    expect(p.resources[0].masteryStart).toBe(5); // clampé à <= 5
  });

  it('plafonne le nombre de blocs', () => {
    const many = Array.from({ length: MAX_RESOURCES + 30 }, () => ({ title: 'x', pages: 1 }));
    expect(sanitizeStoredPlan({ resources: many }).resources).toHaveLength(MAX_RESOURCES);
  });

  it('preserve l’avancement par bloc et alimente le moteur', () => {
    const stored = sanitizeStoredPlan({
      startDate: '2026-01-01',
      examDate: '2026-01-11',
      dailyMaxMinutes: 120,
      bufferRatio: 0,
      speed: { pagesPerHour: 10, chaptersPerHour: 2, qcmPerHour: 60 },
      resources: [{ id: 'r-1', title: 'Cardio', pages: 100, completedMinutes: 120 }],
    });
    expect(completedByResource(stored)).toEqual({ 'r-1': 120 });
    const input = storedPlanToInput(stored);
    const plan = planRevision(input);
    expect(plan.totalWorkloadMinutes).toBe(600); // 100 pages / 10 = 600 min
  });
});

describe('plans — coercions', () => {
  it('coerceExamType retombe sur custom hors liste', () => {
    expect(coerceExamType('edn')).toBe('edn');
    expect(coerceExamType('autre')).toBe('custom');
  });
  it('coercePlanId valide un uuid', () => {
    expect(coercePlanId('11111111-1111-1111-1111-111111111111')).not.toBeNull();
    expect(coercePlanId('r-3')).toBeNull();
  });
  it('newResourceId produit des ids distincts', () => {
    expect(newResourceId()).not.toBe(newResourceId());
  });
});
