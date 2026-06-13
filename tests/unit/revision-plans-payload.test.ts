import { describe, it, expect } from 'vitest';

import { sanitizePlanPayload, coercePlanId } from '@/features/revision/plans';

describe('sanitizePlanPayload — bornage du payload', () => {
  const base = {
    title: '  Mon plan  ',
    examType: 'edn',
    startDate: '2026-09-01',
    examDate: '2026-12-01',
    dailyMaxMinutes: 180,
    pagesPerHour: 8,
    items: [{ title: 'Cardio', pages: 120, priority: 1 }],
  };

  it('accepte un plan valide et nettoie le titre', () => {
    const r = sanitizePlanPayload(base);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.title).toBe('Mon plan');
      expect(r.value.examType).toBe('edn');
      expect(r.value.items).toHaveLength(1);
      expect(r.value.items[0].pages).toBe(120);
    }
  });

  it('refuse une date d’examen antérieure ou égale au début', () => {
    expect(sanitizePlanPayload({ ...base, examDate: '2026-09-01' }).ok).toBe(false);
    expect(sanitizePlanPayload({ ...base, examDate: '2026-08-01' }).ok).toBe(false);
  });

  it('refuse des dates non ISO', () => {
    expect(sanitizePlanPayload({ ...base, startDate: '01/09/2026' }).ok).toBe(false);
    expect(sanitizePlanPayload({ ...base, examDate: 'bientôt' }).ok).toBe(false);
  });

  it('borne les valeurs hors limites et retombe sur des défauts sûrs', () => {
    const r = sanitizePlanPayload({
      ...base,
      examType: 'inconnu',
      dailyMaxMinutes: 99999,
      bufferRatio: 5,
      pagesPerHour: -3,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.examType).toBe('custom');
      expect(r.value.dailyMaxMinutes).toBe(1440);
      expect(r.value.bufferRatio).toBe(0.5);
      expect(r.value.pagesPerHour).toBe(0.1); // valeur négative → bornée au minimum valide (> 0)
    }
  });

  it('ignore les blocs sans titre et borne la priorité', () => {
    const r = sanitizePlanPayload({
      ...base,
      items: [{ title: '   ' }, { title: 'Pneumo', priority: 9 }],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.items).toHaveLength(1);
      expect(r.value.items[0].priority).toBe(3); // 9 → borné à 3
      expect(r.value.items[0].position).toBe(0);
    }
  });

  it('coercePlanId ne valide que des UUID', () => {
    expect(coercePlanId('33333333-3333-3333-3333-333333333333')).toBe(
      '33333333-3333-3333-3333-333333333333',
    );
    expect(coercePlanId('pas-un-uuid')).toBeNull();
    expect(coercePlanId(42)).toBeNull();
  });
});
