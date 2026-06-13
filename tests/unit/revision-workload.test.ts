import { describe, it, expect } from 'vitest';

import {
  itemRemaining,
  itemRemainingMinutes,
  itemTotalMinutes,
  progressPercent,
  totalRemainingMinutes,
  unitMinutes,
} from '@/features/revision/engine/workload';
import type { RevisionItem, SpeedProfile } from '@/features/revision/engine/types';

const speed: SpeedProfile = { pagesPerHour: 10, chaptersPerHour: 2, qcmPerHour: 60 };

function item(partial: Partial<RevisionItem>): RevisionItem {
  return {
    id: 'i',
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

describe('workload — conversion volumes → minutes', () => {
  it('unitMinutes : 100 pages à 10/h = 600 min', () => {
    expect(unitMinutes(100, 10)).toBe(600);
  });

  it('unitMinutes : débit ≤ 0 ou quantité ≤ 0 → 0 (jamais NaN/Infinity)', () => {
    expect(unitMinutes(100, 0)).toBe(0);
    expect(unitMinutes(0, 10)).toBe(0);
    expect(unitMinutes(-5, 10)).toBe(0);
  });

  it('itemTotalMinutes additionne pages + chapitres + QCM', () => {
    const it = item({ pages: 100, chapters: 4, qcm: 60 });
    // 600 + (4/2*60=120) + (60/60*60=60) = 780
    expect(itemTotalMinutes(it, speed)).toBe(780);
  });

  it('itemRemaining ne descend jamais sous 0 (saisie de progression incohérente)', () => {
    const it = item({ pages: 100, completedPages: 130 });
    expect(itemRemaining(it).pages).toBe(0);
  });

  it('itemRemainingMinutes reflète le travail restant', () => {
    const it = item({ pages: 100, completedPages: 40 });
    expect(itemRemainingMinutes(it, speed)).toBe(360); // 60 pages restantes
  });

  it('progressPercent : 0 % au départ, 100 % une fois tout fait', () => {
    const fresh = [item({ pages: 100 })];
    const done = [item({ pages: 100, completedPages: 100 })];
    expect(progressPercent(fresh, speed)).toBe(0);
    expect(progressPercent(done, speed)).toBe(100);
    expect(totalRemainingMinutes(done, speed)).toBe(0);
  });

  it('progressPercent : 100 % si aucun volume à faire', () => {
    expect(progressPercent([], speed)).toBe(100);
  });
});
