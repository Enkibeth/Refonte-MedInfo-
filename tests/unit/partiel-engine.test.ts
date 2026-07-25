/**
 * Tests du MOTEUR statistique de l'analyse des partiels (`public/partiel.html`).
 *
 * Enjeu : cet outil affiche à un étudiant son rang et sa position dans la promo.
 * Un quantile faux, un rang décalé d'un cran ou une moyenne pondérée qui impute
 * un zéro à une absence sont des chiffres FAUX montrés comme vrais — donc tout le
 * cœur mathématique est verrouillé ici, sur le code réellement livré.
 *
 * Le parsing des fichiers est couvert par `partiel-parse.test.ts`.
 */
import { describe, expect, it } from 'vitest';

import { L } from './helpers/partielLogic';

const near = (v: number, expected: number, eps = 1e-9) => expect(Math.abs(v - expected)).toBeLessThan(eps);

describe('quantile (type 7)', () => {
  it('interpole comme numpy / Excel PERCENTILE', () => {
    const s = [1, 2, 3, 4];
    near(L.quantile(s, 0.5), 2.5);
    near(L.quantile(s, 0.25), 1.75);
    near(L.quantile(s, 0.75), 3.25);
    near(L.quantile(s, 0), 1);
    near(L.quantile(s, 1), 4);
  });
  it('gère les tailles dégénérées', () => {
    expect(Number.isNaN(L.quantile([], 0.5))).toBe(true);
    expect(L.quantile([7], 0.9)).toBe(7);
  });
});

describe('stdev', () => {
  it("utilise l'estimateur d'échantillon (n-1), comme un tableur", () => {
    near(L.stdev([2, 4, 4, 4, 5, 5, 7, 9]), Math.sqrt(32 / 7), 1e-12);
  });
  it('renvoie 0 sous 2 valeurs (jamais NaN affiché à l’étudiant)', () => {
    expect(L.stdev([12])).toBe(0);
    expect(L.stdev([])).toBe(0);
  });
});

describe('computeStats', () => {
  it('produit un jeu de quantiles cohérent et trié', () => {
    const st = L.computeStats([12, 8, 15, 10, 14]);
    expect(st.n).toBe(5);
    near(st.mean, 11.8);
    expect(st.min).toBe(8);
    expect(st.max).toBe(15);
    near(st.median, 12);
    expect(st.sorted).toEqual([8, 10, 12, 14, 15]);
    expect(st.q1).toBeLessThanOrEqual(st.median);
    expect(st.median).toBeLessThanOrEqual(st.q3);
  });
  it('ignore les non-nombres et renvoie null si rien n’est exploitable', () => {
    expect(L.computeStats([null, 'ABS', undefined, NaN])).toBeNull();
    expect(L.computeStats([null, 12, 'x']).n).toBe(1);
  });
});

describe('rankOf / percentileOf', () => {
  const sorted = [10, 12, 15, 15, 18];
  it('classe en compétition standard (ex æquo au même rang)', () => {
    expect(L.rankOf(18, sorted)).toBe(1);
    expect(L.rankOf(15, sorted)).toBe(2);
    expect(L.rankOf(12, sorted)).toBe(4);
    expect(L.rankOf(10, sorted)).toBe(5);
  });
  it('partage les ex æquo dans le centile', () => {
    near(L.percentileOf(15, sorted), 60);
    near(L.percentileOf(10, sorted), 10);
    near(L.percentileOf(18, sorted), 90);
  });
  it('renvoie NaN sur une promo vide plutôt qu’un 0 trompeur', () => {
    expect(Number.isNaN(L.percentileOf(12, []))).toBe(true);
  });
});

describe('zScore', () => {
  it('centre et réduit par rapport à la promo', () => {
    const st = { mean: 10, stdev: 2 };
    near(L.zScore(14, st), 2);
    near(L.zScore(10, st), 0);
  });
  it('refuse de calculer quand la promo n’est pas dispersée (σ=0)', () => {
    expect(L.zScore(12, { mean: 12, stdev: 0 })).toBeNull();
    expect(L.zScore(null, { mean: 12, stdev: 2 })).toBeNull();
  });
});

describe('binCountFor / histogramBins', () => {
  it('choisit un découpage rond adapté à l’effectif', () => {
    expect(L.binCountFor(6)).toBe(5);
    expect(L.binCountFor(30)).toBe(10);
    expect(L.binCountFor(100)).toBe(20);
    expect(L.binCountFor(1000)).toBe(40);
  });
  it('compte les effectifs RÉELS, bornes [lo, hi)', () => {
    const bins = L.histogramBins([0, 5, 10, 15, 20], 20, 10);
    expect(bins).toHaveLength(10);
    expect(bins.reduce((s: number, b: any) => s + b.count, 0)).toBe(5);
    expect(bins[0].count).toBe(1); // 0 → [0,2)
    expect(bins[2].count).toBe(1); // 5 → [4,6)
    expect(bins[5].count).toBe(1); // 10 → [10,12)
    expect(bins[7].count).toBe(1); // 15 → [14,16)
    expect(bins[9].count).toBe(1); // 20 → dernière classe (borne haute incluse)
    near(bins[0].share, 0.2);
  });
  it('révèle une distribution bimodale (ce qu’une gaussienne effacerait)', () => {
    const values = [...Array(20).fill(6), ...Array(20).fill(15)];
    const bins = L.histogramBins(values, 20, 20);
    const peaks = bins.filter((b: any) => b.count > 0);
    expect(peaks).toHaveLength(2);
    expect(peaks.every((b: any) => b.count === 20)).toBe(true);
  });
  it('renvoie des classes vides plutôt que rien sur une épreuve sans note', () => {
    const bins = L.histogramBins([], 20, 10);
    expect(bins).toHaveLength(10);
    expect(bins.every((b: any) => b.count === 0)).toBe(true);
  });
});

describe('normalCurvePoints', () => {
  it('exprime la courbe en EFFECTIF attendu par classe (superposable aux barres)', () => {
    const pts = L.normalCurvePoints({ mean: 10, stdev: 2, n: 100 }, 20, 1, 160);
    const atMean = pts.find((p: any) => Math.abs(p.x - 10) < 1e-9);
    near(atMean.y, (100 * 1) / (2 * Math.sqrt(2 * Math.PI)), 1e-9);
    expect(pts[0].y).toBeLessThan(atMean.y);
  });
  it('ne trace rien sans dispersion (aucune courbe inventée)', () => {
    expect(L.normalCurvePoints({ mean: 10, stdev: 0, n: 10 }, 20, 1)).toEqual([]);
    expect(L.normalCurvePoints(null, 20, 1)).toEqual([]);
  });
});

describe('weightOf / weightedMean', () => {
  it('applique les coefficients', () => {
    const wm = L.weightedMean({ A: 10, B: 20 }, ['A', 'B'], { A: 1, B: 3 });
    near(wm.mean, 17.5);
    expect(wm.n).toBe(2);
    expect(wm.weight).toBe(4);
  });
  it('vaut 1 par défaut et rejette les coefficients invalides', () => {
    expect(L.weightOf({}, 'A')).toBe(1);
    expect(L.weightOf({ A: -3 }, 'A')).toBe(1);
    expect(L.weightOf({ A: 'x' }, 'A')).toBe(1);
    expect(L.weightOf({ A: 0 }, 'A')).toBe(0);
  });
  it("N'IMPUTE JAMAIS de zéro à une absence : le coefficient sort du dénominateur", () => {
    const wm = L.weightedMean({ A: 10, B: null }, ['A', 'B'], { A: 1, B: 3 });
    near(wm.mean, 10);
    expect(wm.n).toBe(1);
    expect(wm.weight).toBe(1);
  });
  it('renvoie null (et non 0) quand aucune épreuve n’est notée', () => {
    const wm = L.weightedMean({ A: null }, ['A'], {});
    expect(wm.mean).toBeNull();
  });
  it('un coefficient 0 exclut l’épreuve sans la supprimer du fichier', () => {
    const wm = L.weightedMean({ A: 10, B: 20 }, ['A', 'B'], { A: 1, B: 0 });
    near(wm.mean, 10);
  });
});

describe('cohortMeans / duplicateIds', () => {
  const students = [
    { id: '1', grades: { A: 10, B: 14 } },
    { id: '2', grades: { A: 16, B: 8 } },
    { id: '3', grades: { A: null, B: null } },
  ];
  it('calcule une moyenne par étudiant et ignore ceux sans aucune note', () => {
    const c = L.cohortMeans(students, ['A', 'B'], {});
    near(c.byStudent['1'].mean, 12);
    near(c.byStudent['2'].mean, 12);
    expect(c.byStudent['3']).toBeUndefined();
    expect(c.stats.n).toBe(2);
  });
  it('suit les coefficients', () => {
    const c = L.cohortMeans(students, ['A', 'B'], { A: 3, B: 1 });
    near(c.byStudent['1'].mean, (10 * 3 + 14) / 4);
  });
  it('signale les identifiants en double (ils compteraient deux fois)', () => {
    expect(L.duplicateIds(students)).toEqual([]);
    expect(L.duplicateIds([...students, { id: '1', grades: {} }])).toEqual(['1']);
  });
});

describe('base du classement (comparabilité)', () => {
  // 3 étudiants notés sur les 2 épreuves + 1 seulement sur Anat : classer ce dernier
  // avec les autres compare des moyennes qui ne portent pas sur la même chose.
  const students = [
    { id: 'complet-1', grades: { Anat: 10, Bioch: 10 } },
    { id: 'complet-2', grades: { Anat: 12, Bioch: 12 } },
    { id: 'complet-3', grades: { Anat: 8, Bioch: 8 } },
    { id: 'partiel', grades: { Anat: 18, Bioch: null } },
  ];
  const subjects = ['Anat', 'Bioch'];

  it('par défaut, seuls les étudiants notés sur TOUTES les épreuves incluses sont classés', () => {
    const c = L.cohortMeans(students, subjects, {});
    expect(c.basis).toBe('complete');
    expect(c.counted).toBe(2);
    expect(c.stats.n).toBe(3);
    expect(c.excluded).toBe(1);
    expect(c.byStudent['partiel'].ranked).toBe(false);
    expect(c.byStudent['complet-1'].ranked).toBe(true);
  });

  it('conserve la MOYENNE de l’étudiant hors classement (la base ne change aucune note)', () => {
    const c = L.cohortMeans(students, subjects, {});
    near(c.byStudent['partiel'].mean, 18);
    expect(c.byStudent['partiel'].complete).toBe(false);
    expect(c.byStudent['partiel'].n).toBe(1);
  });

  it('la base « partial » reproduit le comportement précédent', () => {
    const c = L.cohortMeans(students, subjects, {}, 'partial');
    expect(c.basis).toBe('partial');
    expect(c.stats.n).toBe(4);
    expect(c.excluded).toBe(0);
    expect(c.byStudent['partiel'].ranked).toBe(true);
  });

  it('le rang change réellement selon la base (c’est tout l’enjeu)', () => {
    const complete = L.cohortMeans(students, subjects, {});
    const partial = L.cohortMeans(students, subjects, {}, 'partial');
    // Le 18/— capte le rang 1 en base « partial » et disparaît du classement en « complete ».
    expect(L.rankOf(12, complete.stats.sorted)).toBe(1);
    expect(L.rankOf(12, partial.stats.sorted)).toBe(2);
  });

  it('une épreuve à coefficient 0 ne rend personne « incomplet »', () => {
    const c = L.cohortMeans(students, subjects, { Bioch: 0 });
    expect(c.counted).toBe(1);
    expect(c.stats.n).toBe(4);
    expect(c.byStudent['partiel'].ranked).toBe(true);
  });

  it('borne la valeur reçue et retombe sur la base par défaut', () => {
    expect(L.coerceRankingBasis('partial')).toBe('partial');
    expect(L.coerceRankingBasis('n’importe quoi')).toBe('complete');
    expect(L.coerceRankingBasis(undefined)).toBe(L.DEFAULT_RANKING_BASIS);
    expect(L.RANKING_BASES).toEqual(['complete', 'partial']);
  });

  it('aucun étudiant complet → classement vide plutôt qu’un rang trompeur', () => {
    const c = L.cohortMeans([{ id: 'a', grades: { Anat: 10, Bioch: null } }], subjects, {});
    expect(c.stats).toBeNull();
    expect(c.excluded).toBe(1);
  });
});

describe('removeOnce', () => {
  it('retire une seule occurrence, avec tolérance flottante', () => {
    expect(L.removeOnce([1, 2, 2, 3], 2)).toEqual([1, 2, 3]);
    expect(L.removeOnce([1, 2, 3], 5)).toEqual([1, 2, 3]);
    expect(L.removeOnce([0.1 + 0.2, 1], 0.3)).toEqual([1]);
    expect(L.removeOnce([1, 2], null)).toEqual([1, 2]);
  });
});

describe('requiredGrade', () => {
  const subjects = ['A', 'B', 'C'];
  it('donne la note nécessaire dans une épreuve pour viser une moyenne', () => {
    const r = L.requiredGrade({ A: 8, B: 12 }, subjects, {}, 'C', 12, 20);
    near(r.value, 16);
    expect(r.feasible).toBe(true);
  });
  it('signale un objectif hors d’atteinte au lieu de le promettre', () => {
    const r = L.requiredGrade({ A: 8, B: 12 }, subjects, {}, 'C', 18, 20);
    near(r.value, 34);
    expect(r.feasible).toBe(false);
  });
  it('tient compte du coefficient de l’épreuve visée', () => {
    const r = L.requiredGrade({ A: 8, B: 12 }, subjects, { C: 2 }, 'C', 12, 20);
    // (12 × 4 − 20) / 2 = 14
    near(r.value, 14);
  });
  it('refuse une épreuve à coefficient nul ou un objectif non numérique', () => {
    expect(L.requiredGrade({ A: 8 }, subjects, { C: 0 }, 'C', 12, 20)).toBeNull();
    expect(L.requiredGrade({ A: 8 }, subjects, {}, 'C', NaN, 20)).toBeNull();
  });
});

describe('simulateOverall', () => {
  it('reclasse à promo inchangée SANS laisser l’étudiant se classer contre lui-même', () => {
    const sim = L.simulateOverall(
      { A: 12, B: 14 },
      ['A', 'B'],
      {},
      {},
      [8, 10, 12, 14],
      10,
    );
    near(sim.mean, 13);
    expect(sim.total).toBe(4); // 4 étudiants : l'ancienne moyenne a été remplacée
    expect(sim.rank).toBe(2); // [8, 12, 13, 14]
    near(sim.pct, 62.5);
  });
  it('applique les surcharges du simulateur', () => {
    const sim = L.simulateOverall({ A: 8, B: 8 }, ['A', 'B'], {}, { A: 16 }, [8, 12], 8);
    near(sim.mean, 12);
  });
  it('ignore une surcharge non numérique (curseur vidé)', () => {
    const sim = L.simulateOverall({ A: 10, B: 10 }, ['A', 'B'], {}, { A: NaN }, [10], 10);
    near(sim.mean, 10);
  });
  it('renvoie null si plus aucune épreuve n’est notée', () => {
    const sim = L.simulateOverall({ A: null }, ['A'], {}, {}, [10], 10);
    expect(sim.mean).toBeNull();
    expect(sim.rank).toBeNull();
  });
});

describe('subjectInsights / strengthsAndWeaknesses', () => {
  const students: { id: string; grades: Record<string, number | null> }[] = [
    { id: '1', grades: { Anat: 12, Biochimie: 14 } },
    { id: '2', grades: { Anat: 6, Biochimie: 14 } },
    { id: '3', grades: { Anat: 6, Biochimie: 16 } },
    { id: '4', grades: { Anat: 4, Biochimie: 18 } },
  ];
  const subjects = ['Anat', 'Biochimie'];
  const subStats: Record<string, any> = {};
  for (const s of subjects) subStats[s] = L.computeStats(students.map((r) => r.grades[s]));

  it('classe les forces sur le z-score, pas sur la note brute', () => {
    const ins = L.subjectInsights(students[0], subjects, subStats, {});
    const sw = L.strengthsAndWeaknesses(ins, 1);
    // 12 en Anat (promo à 7) vaut mieux que 14 en Biochimie (promo à 15,5).
    expect(sw.strengths[0].subject).toBe('Anat');
    expect(sw.weaknesses[0].subject).toBe('Biochimie');
    expect(sw.strengths[0].z).toBeGreaterThan(0);
    expect(sw.weaknesses[0].z).toBeLessThan(0);
  });
  it('renseigne rang, centile et effectif par épreuve', () => {
    const ins = L.subjectInsights(students[0], subjects, subStats, { Anat: 3 });
    const anat = ins.find((i: any) => i.subject === 'Anat');
    expect(anat.rank).toBe(1);
    expect(anat.n).toBe(4);
    expect(anat.weight).toBe(3);
  });
  it('conserve les épreuves non notées sans inventer de z-score', () => {
    const ins = L.subjectInsights({ grades: { Anat: null, Biochimie: 14 } }, subjects, subStats, {});
    const anat = ins.find((i: any) => i.subject === 'Anat');
    expect(anat.grade).toBeNull();
    expect(anat.z).toBeNull();
    expect(L.strengthsAndWeaknesses(ins, 3).strengths.every((s: any) => s.z != null)).toBe(true);
  });
  it('ne duplique pas une épreuve entre forces et faiblesses quand k dépasse le nombre d’épreuves', () => {
    const ins = L.subjectInsights(students[0], subjects, subStats, {});
    const sw = L.strengthsAndWeaknesses(ins, 5);
    expect(sw.strengths).toHaveLength(2);
    expect(sw.weaknesses).toHaveLength(2);
    expect(sw.strengths[0].subject).toBe(sw.weaknesses[sw.weaknesses.length - 1].subject);
  });
});

describe('validationSummary / defaultPassMark', () => {
  it('sépare validées / non validées / non notées sans imputer d’absence', () => {
    const v = L.validationSummary(
      { grades: { A: 12, B: 8, C: null } },
      ['A', 'B', 'C'],
      10,
    );
    expect(v.passed.map((p: any) => p.subject)).toEqual(['A']);
    expect(v.failed.map((p: any) => p.subject)).toEqual(['B']);
    expect(v.missing).toEqual(['C']);
    expect(v.graded).toBe(2);
  });
  it('valide exactement au seuil', () => {
    const v = L.validationSummary({ grades: { A: 10 } }, ['A'], 10);
    expect(v.passed).toHaveLength(1);
  });
  it('déduit le seuil de l’échelle', () => {
    expect(L.defaultPassMark(20)).toBe(10);
    expect(L.defaultPassMark(100)).toBe(50);
  });
});

describe('normalizeId / findStudent / suggestIds', () => {
  const students = [
    { id: '28710015', grades: {} },
    { id: '28710020', grades: {} },
    { id: 'AB-42', grades: {} },
  ];
  it('retrouve un étudiant malgré espaces, casse et zéros de tête', () => {
    expect(L.findStudent(students, ' 28710015 ')!.id).toBe('28710015');
    expect(L.findStudent(students, '028710015')!.id).toBe('28710015');
    expect(L.findStudent(students, 'ab-42')!.id).toBe('AB-42');
    expect(L.findStudent(students, '999')).toBeNull();
    expect(L.findStudent(students, '')).toBeNull();
  });
  it('normalise identifiants numériques et alphanumériques', () => {
    expect(L.normalizeId('0012 34')).toBe('1234');
    expect(L.normalizeId(' AB c ')).toBe('abc');
    expect(L.normalizeId(null)).toBe('');
  });
  it('propose des identifiants proches au lieu d’un « introuvable » sec', () => {
    const ids = students.map((s) => s.id);
    expect(L.suggestIds('287100', ids, 5)).toEqual(['28710015', '28710020']);
    expect(L.suggestIds('28710016', ids, 5)).toContain('28710015');
    expect(L.suggestIds('', ids, 5)).toEqual([]);
    expect(L.suggestIds('zzzzzz', ids, 5)).toEqual([]);
  });
  it('borne le nombre de suggestions', () => {
    const ids = Array.from({ length: 40 }, (_, i) => `2871${String(i).padStart(4, '0')}`);
    expect(L.suggestIds('2871', ids, 3)).toHaveLength(3);
  });
  it('borne la distance d’édition', () => {
    expect(L.editDistanceCapped('abc', 'abd', 2)).toBe(1);
    expect(L.editDistanceCapped('abc', 'xyz', 2)).toBe(-1);
    expect(L.editDistanceCapped('abcdef', 'abc', 2)).toBe(-1);
  });
});

describe('toCsv', () => {
  it('échappe séparateur, guillemets et sauts de ligne', () => {
    expect(L.toCsv([['a', 'b;c'], [1, 2]])).toBe('a;"b;c"\r\n1;2');
    expect(L.csvCell('dit "oui"')).toBe('"dit ""oui"""');
    expect(L.csvCell(null)).toBe('');
    expect(L.toCsv([])).toBe('');
  });
});

describe('suivi de progression (stockage local)', () => {
  const entryInput = {
    label: 'Partiels S1',
    date: '2026-01-10T10:00:00.000Z',
    scaleMax: 20,
    cohortSize: 300,
    mean: 12.3456,
    rank: 42,
    pct: 86.4444,
    passMark: 10,
    subjects: [{ subject: 'Anat', grade: 14, z: 1.23456, pct: 91.234 }],
  };

  it('ne conserve QUE les résultats dérivés de l’étudiant (jamais la promo)', () => {
    const e = L.buildHistoryEntry(entryInput);
    expect(Object.keys(e).sort()).toEqual(
      ['cohortSize', 'date', 'id', 'label', 'mean', 'passMark', 'pct', 'rank', 'scaleMax', 'subjects'].sort(),
    );
    expect(JSON.stringify(e)).not.toContain('grades');
    expect(e.subjects[0]).toEqual({ subject: 'Anat', grade: 14, z: 1.235, pct: 91.2 });
    expect(e.pct).toBe(86.4);
  });
  it('refuse une entrée sans moyenne exploitable', () => {
    expect(L.buildHistoryEntry({ ...entryInput, mean: null })).toBeNull();
    expect(L.buildHistoryEntry(undefined)).toBeNull();
  });
  it('remplace une entrée de même id, trie par date et plafonne la liste', () => {
    const a = L.buildHistoryEntry({ ...entryInput, id: 'a', date: '2026-01-10T10:00:00.000Z' });
    const b = L.buildHistoryEntry({ ...entryInput, id: 'b', date: '2026-03-10T10:00:00.000Z', mean: 14 });
    const a2 = L.buildHistoryEntry({ ...entryInput, id: 'a', date: '2026-01-10T10:00:00.000Z', mean: 13 });
    let list = L.upsertHistory([], a);
    list = L.upsertHistory(list, b);
    list = L.upsertHistory(list, a2);
    expect(list).toHaveLength(2);
    expect(list.map((e: any) => e.id)).toEqual(['a', 'b']);
    expect(list[0].mean).toBe(13);

    let big: any[] = [];
    for (let i = 0; i < L.HISTORY_MAX + 5; i++) {
      big = L.upsertHistory(
        big,
        L.buildHistoryEntry({ ...entryInput, id: `x${i}`, date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}T10:00:00.000Z` }),
      );
    }
    expect(big).toHaveLength(L.HISTORY_MAX);
  });
  it('relit un stockage local corrompu sans planter', () => {
    expect(L.parseHistory('{pas du json')).toEqual([]);
    expect(L.parseHistory('{"a":1}')).toEqual([]);
    expect(L.parseHistory(JSON.stringify([{ id: 'a', mean: 12 }, { nope: true }]))).toHaveLength(1);
  });
  it('calcule la progression entre les deux dernières sessions', () => {
    const a = L.buildHistoryEntry({ ...entryInput, id: 'a', date: '2026-01-10T10:00:00.000Z', mean: 12, pct: 60 });
    const b = L.buildHistoryEntry({ ...entryInput, id: 'b', date: '2026-03-10T10:00:00.000Z', mean: 14, pct: 75 });
    const trend = L.historyTrend(L.upsertHistory(L.upsertHistory([], a), b));
    near(trend.deltaMean, 2);
    near(trend.deltaPct, 15);
    expect(trend.comparableScale).toBe(true);
    expect(L.historyTrend([a])).toBeNull();
  });
  it('ne compare pas des moyennes d’échelles différentes', () => {
    const a = L.buildHistoryEntry({ ...entryInput, id: 'a', date: '2026-01-10T10:00:00.000Z', mean: 12, scaleMax: 20 });
    const b = L.buildHistoryEntry({ ...entryInput, id: 'b', date: '2026-03-10T10:00:00.000Z', mean: 60, scaleMax: 100 });
    const trend = L.historyTrend([a, b]);
    expect(trend.deltaMean).toBeNull();
    expect(trend.comparableScale).toBe(false);
  });
});

describe('subjectsSignature / parseWeights', () => {
  it('identifie un jeu d’épreuves indépendamment de l’ordre et de la casse', () => {
    expect(L.subjectsSignature(['Anat', 'Biochimie'])).toBe(L.subjectsSignature(['biochimie', ' anat ']));
    expect(L.subjectsSignature(['Anat'])).not.toBe(L.subjectsSignature(['Anat', 'Biochimie']));
  });
  it('ne réutilise que les coefficients des épreuves réellement présentes', () => {
    const raw = JSON.stringify({ Anat: 3, Autre: 5, Mauvais: -1, Trop: 999 });
    expect(L.parseWeights(raw, ['Anat', 'Mauvais', 'Trop'])).toEqual({ Anat: 3 });
    expect(L.parseWeights('cassé', ['Anat'])).toEqual({});
    expect(L.parseWeights(null, ['Anat'])).toEqual({});
  });
});
