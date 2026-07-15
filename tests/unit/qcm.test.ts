import { describe, it, expect } from 'vitest';
import {
  validateQcm,
  scoreQuestion,
  scoreQcm,
  propositionLetter,
  type QcmQuestion,
  type Qcm,
} from '@/qcm/qcm';

// ── Fixtures ─────────────────────────────────────────────────────────────────

function qcs(correctIndex: number, n = 5): QcmQuestion {
  return {
    kind: 'QCS',
    stem: 'Question à réponse unique ?',
    propositions: Array.from({ length: n }, (_, i) => ({
      text: `Proposition ${i}`,
      correct: i === correctIndex,
      explanation: '',
    })),
  };
}

function qcm(correctIndices: number[], n = 5): QcmQuestion {
  return {
    kind: 'QCM',
    stem: 'Question à réponses multiples ?',
    propositions: Array.from({ length: n }, (_, i) => ({
      text: `Proposition ${i}`,
      correct: correctIndices.includes(i),
      explanation: '',
    })),
  };
}

// ── Validation ───────────────────────────────────────────────────────────────

describe('validateQcm', () => {
  it('accepte un QCM bien formé et déduit le type depuis la grille', () => {
    const parsed = validateQcm({
      title: 'Insuffisance cardiaque',
      topic: 'Cardiologie',
      questions: [
        {
          stem: 'Quels signes évoquent une IC gauche ?',
          propositions: [
            { text: 'Orthopnée', correct: true, explanation: 'Signe congestif pulmonaire.' },
            { text: 'Œdèmes des membres inférieurs', correct: false, explanation: 'Plutôt IC droite.' },
            { text: 'Crépitants bilatéraux', correct: true, explanation: 'OAP.' },
          ],
        },
      ],
    });
    expect(parsed).not.toBeNull();
    expect(parsed!.questions).toHaveLength(1);
    // 2 bonnes réponses, aucun kind déclaré → QCM.
    expect(parsed!.questions[0].kind).toBe('QCM');
  });

  it('déduit QCS quand une seule proposition est correcte', () => {
    const parsed = validateQcm({
      questions: [
        {
          stem: 'Antidote du paracétamol ?',
          propositions: [
            { text: 'N-acétylcystéine', correct: true, explanation: '' },
            { text: 'Naloxone', correct: false, explanation: '' },
            { text: 'Flumazénil', correct: false, explanation: '' },
          ],
        },
      ],
    });
    expect(parsed!.questions[0].kind).toBe('QCS');
  });

  it('reclasse un QCS incohérent (plusieurs bonnes réponses) en QCM', () => {
    const parsed = validateQcm({
      questions: [
        {
          kind: 'QCS',
          stem: 'Incohérent',
          propositions: [
            { text: 'A', correct: true, explanation: '' },
            { text: 'B', correct: true, explanation: '' },
            { text: 'C', correct: false, explanation: '' },
          ],
        },
      ],
    });
    expect(parsed!.questions[0].kind).toBe('QCM');
  });

  it('rejette une question sans aucune bonne réponse', () => {
    expect(
      validateQcm({
        questions: [
          {
            stem: 'Aucune bonne',
            propositions: [
              { text: 'A', correct: false, explanation: '' },
              { text: 'B', correct: false, explanation: '' },
              { text: 'C', correct: false, explanation: '' },
            ],
          },
        ],
      }),
    ).toBeNull();
  });

  it('rejette une question avec moins de 3 propositions', () => {
    expect(
      validateQcm({
        questions: [
          {
            stem: 'Trop peu',
            propositions: [
              { text: 'A', correct: true, explanation: '' },
              { text: 'B', correct: false, explanation: '' },
            ],
          },
        ],
      }),
    ).toBeNull();
  });

  it('retourne null quand aucune question exploitable', () => {
    expect(validateQcm({ questions: [] })).toBeNull();
    expect(validateQcm(null)).toBeNull();
    expect(validateQcm({ questions: 'nope' })).toBeNull();
  });

  it('borne le nombre de propositions et de questions', () => {
    const parsed = validateQcm({
      questions: Array.from({ length: 30 }, () => ({
        stem: 'Q',
        propositions: Array.from({ length: 20 }, (_, i) => ({
          text: `P${i}`,
          correct: i === 0,
          explanation: '',
        })),
      })),
    });
    expect(parsed!.questions.length).toBeLessThanOrEqual(15);
    expect(parsed!.questions[0].propositions.length).toBeLessThanOrEqual(8);
  });
});

// ── Notation QCS (tout ou rien) ──────────────────────────────────────────────

describe('scoreQuestion — QCS', () => {
  it('donne 1 pour la seule bonne réponse cochée', () => {
    expect(scoreQuestion(qcs(2), new Set([2])).score).toBe(1);
  });
  it('donne 0 pour une mauvaise réponse', () => {
    expect(scoreQuestion(qcs(2), new Set([1])).score).toBe(0);
  });
  it('donne 0 si plusieurs cases cochées (même avec la bonne)', () => {
    expect(scoreQuestion(qcs(2), new Set([1, 2])).score).toBe(0);
  });
  it('donne 0 sans réponse', () => {
    expect(scoreQuestion(qcs(2), new Set()).score).toBe(0);
  });
});

// ── Notation QCM (barème discordances EDN) ───────────────────────────────────

describe('scoreQuestion — QCM (discordances)', () => {
  const q = qcm([0, 2, 4]); // bonnes : A, C, E

  it('0 discordance → 1', () => {
    const r = scoreQuestion(q, new Set([0, 2, 4]));
    expect(r.discordances).toBe(0);
    expect(r.score).toBe(1);
    expect(r.perfect).toBe(true);
  });
  it('1 discordance (une bonne oubliée) → 0,5', () => {
    const r = scoreQuestion(q, new Set([0, 2]));
    expect(r.discordances).toBe(1);
    expect(r.score).toBe(0.5);
  });
  it('1 discordance (une mauvaise cochée) → 0,5', () => {
    const r = scoreQuestion(q, new Set([0, 2, 4, 1]));
    expect(r.discordances).toBe(1);
    expect(r.score).toBe(0.5);
  });
  it('2 discordances → 0,2', () => {
    const r = scoreQuestion(q, new Set([0])); // oublie C et E
    expect(r.discordances).toBe(2);
    expect(r.score).toBeCloseTo(0.2);
  });
  it('3 discordances ou plus → 0', () => {
    const r = scoreQuestion(q, new Set([1, 3])); // 2 mauvaises cochées + 3 bonnes oubliées → 5
    expect(r.discordances).toBeGreaterThanOrEqual(3);
    expect(r.score).toBe(0);
  });
  it('expose les indices corrects pour surligner la grille', () => {
    expect(scoreQuestion(q, new Set()).correctIndices).toEqual([0, 2, 4]);
  });
});

// ── Notation d'ensemble ──────────────────────────────────────────────────────

describe('scoreQcm', () => {
  const exam: Qcm = {
    title: 'Test',
    topic: 'Divers',
    questions: [qcs(0), qcm([1, 3]), qcm([0, 1, 2])],
  };

  it('somme les points et ramène sur 20', () => {
    // Q1 QCS juste (1), Q2 parfait (1), Q3 1 discordance (0,5) → total 2,5 / 3.
    const res = scoreQcm(exam, [new Set([0]), new Set([1, 3]), new Set([0, 1])]);
    expect(res.total).toBeCloseTo(2.5);
    expect(res.max).toBe(3);
    expect(res.perfectCount).toBe(2);
    expect(res.over20).toBeCloseTo(16.5); // 2.5/3*20 = 16.67 → arrondi demi-point 16.5
  });

  it('gère les réponses manquantes comme des cases vides', () => {
    // Q1 QCS juste (1) ; Q2 (2 bonnes) laissé vide → 2 discordances = 0,2 ; Q3 absent → 0.
    const res = scoreQcm(exam, [new Set([0])]);
    expect(res.total).toBeCloseTo(1.2);
    expect(res.over20).toBeGreaterThanOrEqual(0);
  });

  it('sans aucune réponse : QCS à 0, mais les QCM gardent le partiel « discordances » EDN', () => {
    // Barème EDN authentique : ne rien cocher sur un QCM à 2 bonnes réponses = 2 discordances
    // = 0,2 pt (quirk connu du barème). Ici Q1 QCS→0, Q2 (2 bonnes)→0,2, Q3 (3 bonnes)→0.
    const res = scoreQcm(exam, []);
    expect(res.total).toBeCloseTo(0.2);
    expect(res.perfectCount).toBe(0);
    expect(res.over20).toBeCloseTo(1.5); // 0.2/3*20 = 1.33 → arrondi demi-point 1.5
  });

  it('note vraiment 0/20 quand tout est faux', () => {
    // Coche toutes les mauvaises et aucune bonne → discordances maximales partout.
    const res = scoreQcm(
      { title: 't', topic: '', questions: [qcs(0), qcm([0, 1])] },
      [new Set([1]), new Set([2, 3, 4])],
    );
    expect(res.total).toBe(0);
    expect(res.over20).toBe(0);
  });
});

describe('propositionLetter', () => {
  it('mappe 0→A, 4→E', () => {
    expect(propositionLetter(0)).toBe('A');
    expect(propositionLetter(4)).toBe('E');
  });
});
