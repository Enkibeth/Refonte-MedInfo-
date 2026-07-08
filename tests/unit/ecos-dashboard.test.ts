import { describe, it, expect } from 'vitest';

import { parseScoreFromEvaluation, scoreTone, formatScore } from '@/ecos/score';
import {
  computeEcosStats,
  summarizeAttemptsByCase,
  filterCases,
  groupCasesByTheme,
  listThemes,
  type AttemptLite,
} from '@/ecos/dashboard';

// ── parseScoreFromEvaluation ────────────────────────────────────────────────

describe('parseScoreFromEvaluation — extraction déterministe de la note', () => {
  it('lit le format canonique « **Note : X/20** »', () => {
    expect(parseScoreFromEvaluation('## Résultat global\n**Note : 14/20**\nBien.')).toBe(14);
  });

  it('accepte décimales à virgule et à point', () => {
    expect(parseScoreFromEvaluation('Note : 14,5/20')).toBe(14.5);
    expect(parseScoreFromEvaluation('Note estimée : 12.5 / 20')).toBe(12.5);
  });

  it('tolère les anciens formats libres (première fraction x/20)', () => {
    expect(parseScoreFromEvaluation('La performance mérite environ 11/20 au total.')).toBe(11);
  });

  it('prend la PREMIÈRE fraction (celle du résultat global)', () => {
    expect(parseScoreFromEvaluation('**Note : 13/20**\n…item coté 2/20 dans la grille')).toBe(13);
  });

  it('ne matche pas « /200 » ni une note hors barème', () => {
    expect(parseScoreFromEvaluation('score 14/200')).toBeNull();
    expect(parseScoreFromEvaluation('Note : 25/20')).toBeNull();
  });

  it('null si aucune note (jamais de chiffre inventé)', () => {
    expect(parseScoreFromEvaluation('')).toBeNull();
    expect(parseScoreFromEvaluation('Bonne anamnèse, poursuivez.')).toBeNull();
  });
});

describe('scoreTone / formatScore', () => {
  it('applique le barème couleur ≥14 / ≥10 / <10', () => {
    expect(scoreTone(14)).toBe('success');
    expect(scoreTone(13.9)).toBe('warning');
    expect(scoreTone(10)).toBe('warning');
    expect(scoreTone(9.9)).toBe('danger');
  });

  it('formate à la française sans décimale inutile', () => {
    expect(formatScore(14)).toBe('14');
    expect(formatScore(14.5)).toBe('14,5');
  });
});

// ── Stats globales ──────────────────────────────────────────────────────────

const attempts: AttemptLite[] = [
  { caseSlug: 'a', score: 10, createdAt: '2026-07-01T10:00:00Z' },
  { caseSlug: 'a', score: 14, createdAt: '2026-07-03T10:00:00Z' },
  { caseSlug: 'b', score: null, createdAt: '2026-07-02T10:00:00Z' },
  { caseSlug: 'retire', score: 20, createdAt: '2026-07-04T10:00:00Z' },
];

describe('computeEcosStats', () => {
  it('calcule dispo / passages / couverture / moyenne / meilleure', () => {
    const stats = computeEcosStats(['a', 'b', 'c'], attempts);
    expect(stats.casesAvailable).toBe(3);
    expect(stats.attemptsCount).toBe(4);
    // Le cas retiré du catalogue ne compte pas dans la couverture.
    expect(stats.casesAttempted).toBe(2);
    // Moyenne sur les notes CONNUES seulement : (10 + 14 + 20) / 3.
    expect(stats.averageScore).toBe(14.7);
    expect(stats.bestScore).toBe(20);
  });

  it('moyenne null sans aucune note', () => {
    const stats = computeEcosStats(['a'], [{ caseSlug: 'a', score: null, createdAt: '2026-07-01' }]);
    expect(stats.averageScore).toBeNull();
    expect(stats.bestScore).toBeNull();
    expect(stats.attemptsCount).toBe(1);
  });
});

describe('summarizeAttemptsByCase', () => {
  it('donne meilleure + dernière note par cas, quel que soit l’ordre d’entrée', () => {
    const shuffled = [attempts[1], attempts[3], attempts[0], attempts[2]];
    const summaries = summarizeAttemptsByCase(shuffled);
    const a = summaries.get('a')!;
    expect(a.attempts).toBe(2);
    expect(a.best).toBe(14);
    expect(a.last).toBe(14); // passage du 03/07 plus récent que celui du 01/07
    const b = summaries.get('b')!;
    expect(b.attempts).toBe(1);
    expect(b.best).toBeNull();
    expect(b.last).toBeNull();
  });
});

// ── Filtres + groupement par thème ──────────────────────────────────────────

const cases = [
  { id: 'dt', titre: 'Douleur thoracique', specialite: 'Cardiologie', consigneCandidat: 'ECG et anamnèse' },
  { id: 'ce', titre: 'Céphalées brutales', specialite: 'Neurologie', consigneCandidat: 'Examen neuro' },
  { id: 'oap', titre: 'Dyspnée aiguë', specialite: 'Cardiologie', consigneCandidat: 'Auscultation' },
  { id: 'sans', titre: 'Cas orphelin', specialite: '  ', consigneCandidat: 'Divers' },
];
const summaries = summarizeAttemptsByCase([
  { caseSlug: 'dt', score: 12, createdAt: '2026-07-01T10:00:00Z' },
]);

describe('filterCases', () => {
  it('filtre par thème', () => {
    const out = filterCases(cases, { query: '', theme: 'Cardiologie', status: 'all' }, summaries);
    expect(out.map((c) => c.id)).toEqual(['dt', 'oap']);
  });

  it('filtre par statut fait / à faire', () => {
    const done = filterCases(cases, { query: '', theme: null, status: 'done' }, summaries);
    expect(done.map((c) => c.id)).toEqual(['dt']);
    const todo = filterCases(cases, { query: '', theme: null, status: 'todo' }, summaries);
    expect(todo.map((c) => c.id)).toEqual(['ce', 'oap', 'sans']);
  });

  it('recherche insensible à la casse sur titre / spécialité / consigne', () => {
    const out = filterCases(cases, { query: 'NEURO', theme: null, status: 'all' }, summaries);
    expect(out.map((c) => c.id)).toEqual(['ce']);
  });

  it('cumule les filtres', () => {
    const out = filterCases(cases, { query: 'dyspnée', theme: 'Cardiologie', status: 'todo' }, summaries);
    expect(out.map((c) => c.id)).toEqual(['oap']);
  });
});

describe('groupCasesByTheme / listThemes', () => {
  it('groupe par spécialité, thèmes triés alphabétiquement, vide → « Autre »', () => {
    const groups = groupCasesByTheme(cases);
    expect(groups.map((g) => g.theme)).toEqual(['Autre', 'Cardiologie', 'Neurologie']);
    expect(groups[1].cases.map((c) => c.id)).toEqual(['dt', 'oap']);
    expect(listThemes(cases)).toEqual(['Autre', 'Cardiologie', 'Neurologie']);
  });
});
