/**
 * Passerelle Partiels → chat (ADR-0044) : le message préparé pour le chat ne contient QUE
 * les résultats de l'étudiant et des agrégats de promo assez larges pour ne révéler la note
 * de personne. Fonction réellement livrée (bloc @partiel-logic de public/partiel.html).
 */
import { describe, expect, it } from 'vitest';

import { L } from './helpers/partielLogic';

const insights = [
  { subject: 'Anatomie', grade: 8, z: -1.2, mean: 10.5, n: 210 },
  { subject: 'Biochimie', grade: 15, z: 0.9, mean: 12.1, n: 210 },
  { subject: 'Physiologie', grade: 12, z: 0.1, mean: 11.8, n: 210 },
];

const base = {
  mean: 11.67,
  n: 3,
  counted: 3,
  rank: 45,
  pct: 78.6,
  total: 210,
  ranked: true,
  promoMedian: 11.2,
  scaleMax: 20,
  passMark: 10,
  insights,
  validation: { passed: [], failed: [{ subject: 'Anatomie', grade: 8 }], missing: [], graded: 3 },
};

describe('message préparé pour le chat', () => {
  it('résume la position, épreuve par épreuve, forces et faiblesses', () => {
    const text: string = L.chatBriefing(base);
    expect(text).toContain('Moyenne : 11,67/20 ; rang 45 sur 210 (centile 79) ; médiane de la promo : 11,20.');
    expect(text).toContain('  - Anatomie : 8,00 (promo 10,50 ; −1,20 σ)');
    expect(text).toContain('Points forts par rapport à la promo : Biochimie, Physiologie.');
    expect(text).toContain('À retravailler par rapport à la promo : Anatomie.');
    expect(text).toContain('Sous le seuil de 10,0 : Anatomie (8,00).');
    expect(text).toMatch(/sans les recalculer et sans en inventer/);
  });

  it('petite promo : aucun agrégat ni rang (la moyenne trahirait la note des autres)', () => {
    const small = {
      ...base,
      total: 3,
      rank: 1,
      insights: insights.map((i) => ({ ...i, n: 3 })),
    };
    const text: string = L.chatBriefing(small);
    expect(L.CHAT_K_MIN).toBe(5);
    expect(text).not.toContain('promo 10,50');
    expect(text).not.toContain('rang');
    expect(text).not.toContain('σ');
    expect(text).not.toContain('Points forts');
    expect(text).toContain('  - Anatomie : 8,00');
  });

  it('hors classement : dit pourquoi, sans rang', () => {
    const text: string = L.chatBriefing({ ...base, ranked: false, rank: null, n: 2 });
    expect(text).toContain('hors classement (moyenne sur 2 épreuve(s) sur 3)');
    expect(text).not.toContain('rang 45');
  });

  it('rien à transmettre sans moyenne ni note', () => {
    expect(L.chatBriefing({ ...base, mean: null })).toBeNull();
    expect(L.chatBriefing({ ...base, insights: [] })).toBeNull();
    expect(L.chatBriefing(null)).toBeNull();
  });

  it('borné en taille et une épreuve ne casse jamais la mise en forme', () => {
    const many = Array.from({ length: 60 }, (_, k) => ({ subject: `UE ${k}\nligne`, grade: 10, z: 0, mean: 10, n: 50 }));
    const text: string = L.chatBriefing({ ...base, insights: many });
    expect(text.length).toBeLessThanOrEqual(6000);
    expect(text).toContain('… et 35 autre(s) épreuve(s).');
    expect(text).not.toMatch(/UE 0\nligne/);
  });
});
