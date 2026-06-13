import { describe, it, expect } from 'vitest';

import { buildPlan, tasksForDate, formatMinutes } from '@/features/revision/engine/planner';
import type { PlannerInput, RevisionItem, SpeedProfile } from '@/features/revision/engine/types';

const speed: SpeedProfile = { pagesPerHour: 10, chaptersPerHour: 2, qcmPerHour: 60 };

function item(partial: Partial<RevisionItem>): RevisionItem {
  return {
    id: Math.random().toString(36).slice(2),
    title: 'Bloc',
    pages: 0,
    chapters: 0,
    qcm: 0,
    priority: 2,
    completedPages: 0,
    completedChapters: 0,
    completedQcm: 0,
    ...partial,
  };
}

function input(partial: Partial<PlannerInput>): PlannerInput {
  return {
    today: '2026-06-15', // lundi
    window: {
      startDate: '2026-06-15',
      examDate: '2026-06-25', // 10 jours utilisables (pas de repos/indispo)
      unavailableDays: [],
      restWeekdays: [],
      dailyMaxMinutes: 240,
    },
    speed,
    items: [],
    bufferRatio: 0,
    ...partial,
  };
}

describe('planner — cas de base', () => {
  it('100 pages sur 10 jours à 10 pages/h ⇒ ~1 h/jour (60 min) et plan vert', () => {
    const r = buildPlan(input({ items: [item({ id: 'p', pages: 100 })] }));
    expect(r.usableDays).toBe(10);
    expect(r.schedulingDays).toBe(10);
    expect(r.totalRemainingMinutes).toBe(600);
    expect(r.dailyAverageMinutes).toBe(60);
    expect(r.overflowMinutes).toBe(0);
    expect(r.risk.level).toBe('green');
    // Chaque jour planifiable porte ~60 min (réparti, pas entassé).
    for (const day of r.byDay) expect(day.minutes).toBeLessThanOrEqual(60);
    // La somme des minutes planifiées = le total restant.
    const planned = r.byDay.reduce((s, d) => s + d.minutes, 0);
    expect(planned).toBe(600);
  });

  it('aucune tâche n’est posée sur un jour indisponible', () => {
    const r = buildPlan(
      input({
        items: [item({ id: 'p', pages: 100 })],
        window: { ...input({}).window, unavailableDays: ['2026-06-17', '2026-06-18'] },
      }),
    );
    expect(r.usableDays).toBe(8);
    expect(tasksForDate(r, '2026-06-17')).toHaveLength(0);
    expect(tasksForDate(r, '2026-06-18')).toHaveLength(0);
    expect(r.byDay.some((d) => d.date === '2026-06-17')).toBe(false);
  });

  it('exclut les jours de repos hebdomadaires (samedi/dimanche)', () => {
    const r = buildPlan(
      input({
        items: [item({ id: 'p', pages: 60 })],
        window: { ...input({}).window, restWeekdays: [0, 6] },
      }),
    );
    // Du lun 15 au mer 24 inclus, sans sam 20 / dim 21 → 8 jours.
    expect(r.usableDays).toBe(8);
    expect(r.byDay.every((d) => d.weekday !== 0 && d.weekday !== 6)).toBe(true);
  });
});

describe('planner — réalisme / risque', () => {
  it('plan impossible (plafond insuffisant) ⇒ débordement et risque rouge', () => {
    const r = buildPlan(
      input({
        items: [item({ id: 'p', pages: 100 })], // 600 min
        window: {
          startDate: '2026-06-15',
          examDate: '2026-06-17', // 2 jours
          unavailableDays: [],
          restWeekdays: [],
          dailyMaxMinutes: 120,
        },
      }),
    );
    expect(r.schedulingDays).toBe(2);
    expect(r.overflowMinutes).toBe(360); // 600 − 2×120
    expect(r.risk.level).toBe('red');
  });

  it('plan tendu (charge ≈ plafond) ⇒ orange', () => {
    // 600 min sur 3 jours = 200/j, plafond 220 → ratio ~0.9 → orange
    const r = buildPlan(
      input({
        items: [item({ id: 'p', pages: 100 })],
        window: {
          startDate: '2026-06-15',
          examDate: '2026-06-18',
          unavailableDays: [],
          restWeekdays: [],
          dailyMaxMinutes: 220,
        },
      }),
    );
    expect(r.dailyAverageMinutes).toBe(200);
    expect(r.risk.level).toBe('orange');
  });

  it('conserve des jours tampon en fin de période (bufferRatio)', () => {
    const r = buildPlan(input({ items: [item({ id: 'p', pages: 100 })], bufferRatio: 0.2 }));
    expect(r.bufferDays).toBe(2); // floor(10 × 0.2)
    expect(r.schedulingDays).toBe(8);
    // Les 2 derniers jours sont tampon ; sans contenu nouveau (study).
    const lastTwo = r.byDay.slice(-2);
    expect(lastTwo.every((d) => d.buffer)).toBe(true);
    expect(lastTwo.every((d) => d.tasks.every((t) => t.kind !== 'study'))).toBe(true);
  });

  it('révision espacée : pose un rappel actif sur chaque jour tampon', () => {
    const r = buildPlan(
      input({ items: [item({ id: 'p', pages: 100 })], bufferRatio: 0.2, spacedRepetition: true }),
    );
    const buffers = r.byDay.filter((d) => d.buffer);
    expect(buffers).toHaveLength(2);
    expect(buffers.every((d) => d.tasks.some((t) => t.kind === 'review'))).toBe(true);
  });
});

describe('planner — recalcul après retard (redistribution)', () => {
  it('avancer la date et marquer du retard augmente le rythme requis', () => {
    const base = input({ items: [item({ id: 'p', pages: 100 })] });
    const before = buildPlan(base);
    // 4 jours plus tard, rien n'a été fait : 600 min restent sur 6 jours.
    const after = buildPlan({
      ...base,
      today: '2026-06-19',
      items: [item({ id: 'p', pages: 100, completedPages: 0 })],
    });
    expect(after.schedulingDays).toBe(6);
    expect(after.dailyAverageMinutes).toBeGreaterThan(before.dailyAverageMinutes);
  });

  it('progression : cocher du travail réduit le restant et fait monter le %', () => {
    const r = buildPlan(input({ items: [item({ id: 'p', pages: 100, completedPages: 50 })] }));
    expect(r.totalRemainingMinutes).toBe(300);
    expect(r.progressPercent).toBe(50);
  });

  it('déterministe : mêmes entrées ⇒ mêmes sorties (aucun effet de bord/IA)', () => {
    const inp = input({ items: [item({ id: 'p', pages: 100 }), item({ id: 'q', chapters: 6 })] });
    expect(JSON.stringify(buildPlan(inp))).toBe(JSON.stringify(buildPlan(inp)));
  });
});

describe('planner — vides / dégénérés', () => {
  it('aucun bloc ⇒ progression 100 %, plan vert, pas de tâche', () => {
    const r = buildPlan(input({ items: [] }));
    expect(r.progressPercent).toBe(100);
    expect(r.tasks).toHaveLength(0);
    expect(r.risk.level).toBe('green');
  });

  it("examen déjà passé ⇒ plus aucun jour planifiable, risque rouge", () => {
    const r = buildPlan(
      input({
        today: '2026-06-30',
        items: [item({ id: 'p', pages: 100 })],
        window: { ...input({}).window },
      }),
    );
    expect(r.schedulingDays).toBe(0);
    expect(r.daysUntilExam).toBe(0);
    expect(r.risk.level).toBe('red');
  });

  it('formatMinutes rend une durée lisible', () => {
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(60)).toBe('1 h');
    expect(formatMinutes(165)).toBe('2 h 45');
  });
});
