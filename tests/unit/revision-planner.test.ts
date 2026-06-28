import { describe, it, expect } from 'vitest';

import type { PlanInput, RevisionResource, SpeedProfile } from '@/revision/types';
import { planRevision } from '@/revision/engine/planner';
import { redistribute } from '@/revision/engine/redistribution';
import { assessRisk, RISK_THRESHOLDS } from '@/revision/engine/riskScoring';
import { resourceMinutes, totalWorkloadMinutes, dominantTaskType } from '@/revision/engine/workload';
import { enumerateDays, daysBetween } from '@/revision/engine/dates';
import { usableStudyDays } from '@/revision/engine/planner';

const SPEED: SpeedProfile = { pagesPerHour: 10, chaptersPerHour: 2, qcmPerHour: 60 };

function resource(over: Partial<RevisionResource> = {}): RevisionResource {
  return { id: 'r1', title: 'Cardiologie', pages: 0, chapters: 0, qcm: 0, priority: 1, ...over };
}

function planInput(over: Partial<PlanInput> = {}): PlanInput {
  return {
    startDate: '2026-01-01',
    examDate: '2026-01-11', // 10 jours travaillables (01-01 → 01-10)
    unavailableDays: [],
    dailyMaxMinutes: 120,
    bufferRatio: 0,
    speed: SPEED,
    resources: [resource({ pages: 100 })],
    ...over,
  };
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('workload — conversion volumes → minutes', () => {
  it('100 pages à 10 pages/h = 600 minutes', () => {
    expect(resourceMinutes(resource({ pages: 100 }), SPEED)).toBe(600);
  });

  it('somme les trois composantes (pages + chapitres + QCM)', () => {
    const r = resource({ pages: 10, chapters: 2, qcm: 60 }); // 60 + 60 + 60
    expect(resourceMinutes(r, SPEED)).toBe(180);
  });

  it('ne fabrique aucun chiffre si le rythme est absent (0 → 0 minute)', () => {
    const r = resource({ pages: 100 });
    expect(resourceMinutes(r, { ...SPEED, pagesPerHour: 0 })).toBe(0);
  });

  it('déduit le type de tâche dominant', () => {
    expect(dominantTaskType(resource({ pages: 100 }), SPEED)).toBe('reading');
    expect(dominantTaskType(resource({ qcm: 600 }), SPEED)).toBe('qcm');
    expect(dominantTaskType(resource(), SPEED)).toBe('custom');
  });
});

describe('dates — fenêtre de jours (UTC, déterministe)', () => {
  it('le jour d’examen n’est pas un jour travaillé', () => {
    expect(enumerateDays('2026-01-01', '2026-01-11')).toHaveLength(10);
    expect(enumerateDays('2026-01-01', '2026-01-11')).not.toContain('2026-01-11');
  });

  it('daysBetween ne devient jamais négatif', () => {
    expect(daysBetween('2026-01-11', '2026-01-01')).toBe(0);
    expect(daysBetween('2026-01-01', '2026-01-11')).toBe(10);
  });
});

describe('planRevision — cas nominal (anti-panique, charge lissée)', () => {
  it('100 pages sur 10 jours à 10 pages/h ≈ 1 h/jour', () => {
    const plan = planRevision(planInput());
    expect(plan.usableDaysCount).toBe(10);
    expect(plan.totalWorkloadMinutes).toBe(600);
    expect(plan.dailyAverageMinutes).toBeCloseTo(60, 5);
    expect(plan.risk.level).toBe('green');
    // Charge lissée : chaque jour ~60 min, aucun jour vide, aucune surcharge.
    expect(plan.dailyLoads).toHaveLength(10);
    for (const d of plan.dailyLoads) {
      expect(d.minutes).toBeCloseTo(60, 5);
      expect(d.overCapacity).toBe(false);
    }
    // Conservation : la somme des tâches = charge totale.
    expect(sum(plan.tasks.map((t) => t.minutes))).toBeCloseTo(600, 5);
  });
});

describe('planRevision — jours indisponibles', () => {
  it('exclut les jours indispo de la fenêtre et du planning', () => {
    const plan = planRevision(planInput({ unavailableDays: ['2026-01-03', '2026-01-04'] }));
    expect(plan.usableDaysCount).toBe(8);
    const dates = new Set(plan.tasks.map((t) => t.date));
    expect(dates.has('2026-01-03')).toBe(false);
    expect(dates.has('2026-01-04')).toBe(false);
    // Le travail total est conservé, juste réparti sur moins de jours.
    expect(sum(plan.tasks.map((t) => t.minutes))).toBeCloseTo(600, 5);
    expect(plan.dailyAverageMinutes).toBeCloseTo(75, 5); // 600 / 8
  });
});

describe('planRevision — plan irréaliste (jamais masqué)', () => {
  it('passe rouge quand la capacité quotidienne est insuffisante', () => {
    const plan = planRevision(planInput({ dailyMaxMinutes: 30 })); // besoin 60/j, capacité 30
    expect(plan.risk.level).toBe('red');
    expect(plan.risk.capacityRatio).toBeGreaterThan(RISK_THRESHOLDS.overload);
    // La surcharge est visible jour par jour.
    expect(plan.dailyLoads.every((d) => d.overCapacity)).toBe(true);
  });

  it('passe rouge s’il n’y a aucun jour disponible', () => {
    const plan = planRevision(planInput({ startDate: '2026-01-11', examDate: '2026-01-11' }));
    expect(plan.usableDaysCount).toBe(0);
    expect(plan.risk.level).toBe('red');
    expect(plan.tasks).toHaveLength(0);
  });
});

describe('assessRisk — seuils vert / orange / rouge', () => {
  it('vert sous 80 % de capacité', () => {
    expect(assessRisk({ totalMinutes: 700, usableDays: 10, dailyMaxMinutes: 120 }).level).toBe('green');
  });
  it('orange entre 80 et 110 %', () => {
    expect(assessRisk({ totalMinutes: 1000, usableDays: 10, dailyMaxMinutes: 120 }).level).toBe('orange');
  });
  it('rouge au-delà de 110 %', () => {
    expect(assessRisk({ totalMinutes: 1400, usableDays: 10, dailyMaxMinutes: 120 }).level).toBe('red');
  });
  it('rouge si retard > 10 % même quand la charge tient', () => {
    const r = assessRisk({ totalMinutes: 600, usableDays: 10, dailyMaxMinutes: 120, latenessRatio: 0.2 });
    expect(r.level).toBe('red');
    expect(r.reason).toMatch(/retard/i);
  });
});

describe('redistribute — recalcul après avancement / report', () => {
  it('le buffer final est conservé dans la charge totale', () => {
    const plan = redistribute(planInput({ bufferRatio: 0.1 }));
    expect(plan.totalWorkloadMinutes).toBeCloseTo(660, 5); // 600 * 1.1
    expect(plan.remainingWorkloadMinutes).toBeCloseTo(660, 5);
    expect(plan.progressPercent).toBe(0);
  });

  it('retranche le travail fait et met à jour la progression', () => {
    const plan = redistribute(planInput(), { completedMinutesByResource: { r1: 300 } });
    expect(plan.remainingWorkloadMinutes).toBeCloseTo(300, 5);
    expect(plan.progressPercent).toBeCloseTo(50, 5);
  });

  it('redistribue le reliquat sur les jours restants → charge quotidienne plus élevée', () => {
    // Au 6e jour (5 jours déjà passés), 300 min faites, 300 restantes sur 5 jours → 60/j.
    const plan = redistribute(planInput(), {
      today: '2026-01-06',
      completedMinutesByResource: { r1: 300 },
    });
    expect(plan.usableDaysCount).toBe(5); // 01-06 → 01-10
    expect(plan.dailyAverageMinutes).toBeCloseTo(60, 5);
    expect(sum(plan.tasks.map((t) => t.minutes))).toBeCloseTo(300, 5);
  });

  it('respecte la priorité : la ressource prioritaire est planifiée en premier', () => {
    const plan = redistribute(
      planInput({
        resources: [
          resource({ id: 'low', title: 'Annexe', pages: 50, priority: 5 }),
          resource({ id: 'high', title: 'Item clé', pages: 50, priority: 1 }),
        ],
      }),
    );
    expect(plan.tasks[0].resourceId).toBe('high');
  });
});

describe('usableStudyDays — borne « à partir d’aujourd’hui »', () => {
  it('démarre au plus tard entre le début du plan et aujourd’hui', () => {
    const days = usableStudyDays(planInput(), '2026-01-08');
    expect(days).toEqual(['2026-01-08', '2026-01-09', '2026-01-10']);
  });
});
