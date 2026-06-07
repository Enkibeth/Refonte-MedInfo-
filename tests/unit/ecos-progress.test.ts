import { describe, it, expect } from 'vitest';

import {
  parseEcosScore,
  computeProgress,
  lastScoreByCase,
  type EcosSession,
} from '@/lib/ecosProgress';

describe('ecosProgress — parseEcosScore', () => {
  it('extrait une note "14/20"', () => {
    expect(parseEcosScore('**Note : 14/20**\n\n## Grille')).toBe(14);
  });

  it('gère les espaces "14 / 20"', () => {
    expect(parseEcosScore('Note estimée : 12 / 20')).toBe(12);
  });

  it('gère la forme "x sur 20"', () => {
    expect(parseEcosScore('note estimée : 9 sur 20')).toBe(9);
  });

  it('gère les décimales françaises "14,5/20"', () => {
    expect(parseEcosScore('**Note : 14,5/20**')).toBe(14.5);
  });

  it('ignore les fractions d\'items et prend la note /20', () => {
    // « 2/2 » (item) ne doit pas être pris ; seule « 16/20 » est plausible.
    expect(parseEcosScore('- item 2/2\n\n**Note : 16/20**')).toBe(16);
  });

  it('renvoie null si aucune note /20', () => {
    expect(parseEcosScore('Pas de note ici, juste 3/4 items.')).toBeNull();
    expect(parseEcosScore('')).toBeNull();
  });

  it('rejette les valeurs hors bornes', () => {
    expect(parseEcosScore('99/20')).toBeNull();
  });
});

describe('ecosProgress — computeProgress', () => {
  const sessions: EcosSession[] = [
    { caseId: 'a', caseTitle: 'A', specialty: 'X', score: 16, date: '2026-06-07T10:00:00Z' },
    { caseId: 'b', caseTitle: 'B', specialty: 'Y', score: 12, date: '2026-06-06T10:00:00Z' },
    { caseId: 'c', caseTitle: 'C', specialty: 'Z', score: null, date: '2026-06-05T10:00:00Z' },
  ];

  it('agrège total, moyenne et meilleure note', () => {
    const p = computeProgress(sessions);
    expect(p.total).toBe(3);
    expect(p.scored).toBe(2);
    expect(p.averageOn20).toBe(14);
    expect(p.bestOn20).toBe(16);
    expect(p.lastDate).toBe('2026-06-07T10:00:00Z');
  });

  it('gère une liste vide', () => {
    expect(computeProgress([])).toEqual({
      total: 0,
      scored: 0,
      averageOn20: null,
      bestOn20: null,
      lastDate: null,
    });
  });
});

describe('ecosProgress — lastScoreByCase', () => {
  it('garde la première (plus récente) note par cas', () => {
    const sessions: EcosSession[] = [
      { caseId: 'a', caseTitle: 'A', specialty: 'X', score: 15, date: '2026-06-07T10:00:00Z' },
      { caseId: 'a', caseTitle: 'A', specialty: 'X', score: 9, date: '2026-06-01T10:00:00Z' },
      { caseId: 'b', caseTitle: 'B', specialty: 'Y', score: null, date: '2026-06-02T10:00:00Z' },
    ];
    expect(lastScoreByCase(sessions)).toEqual({ a: 15, b: null });
  });
});
