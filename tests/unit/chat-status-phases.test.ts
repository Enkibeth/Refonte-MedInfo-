import { describe, it, expect } from 'vitest';

import {
  CHAT_PHASE_ORDER,
  chatPhaseLabel,
  chatPhaseView,
  isPhaseDone,
  monotonicProgress,
  type ChatPhase,
} from '@/ai/chat/statusPhases';

describe('chatPhaseView — modèle de l’anneau de progression', () => {
  it('progresse dans l’ordre raisonnement → recherche → rédaction', () => {
    const p = CHAT_PHASE_ORDER.map((phase) => chatPhaseView(phase).progress);
    expect(p).toEqual([...p].sort((a, b) => a - b));
    expect(new Set(p).size).toBe(p.length); // trois valeurs distinctes
  });

  it('ne referme JAMAIS l’anneau : un cercle plein dirait « terminé »', () => {
    for (const phase of CHAT_PHASE_ORDER) {
      const { progress } = chatPhaseView(phase);
      expect(progress).toBeGreaterThan(0);
      expect(progress).toBeLessThan(1);
    }
  });

  it('donne une icône et un libellé à chaque phase, reprise comprise', () => {
    for (const phase of ['thinking', 'searching', 'writing', 'recovering'] as ChatPhase[]) {
      const v = chatPhaseView(phase);
      expect(v.icon).toBeTruthy();
      expect(v.label.length).toBeGreaterThan(3);
    }
  });

  it('classe la reprise hors de la progression (step -1)', () => {
    expect(chatPhaseView('recovering').step).toBe(-1);
    expect(chatPhaseView('thinking').step).toBe(0);
    expect(chatPhaseView('writing').step).toBe(2);
  });

  it('repli sur le raisonnement pour une phase inconnue', () => {
    expect(chatPhaseView('nawak' as ChatPhase)).toEqual(chatPhaseView('thinking'));
  });
});

describe('chatPhaseLabel — le détail d’outil ne prend la main qu’en recherche', () => {
  it('affiche la requête réellement cherchée pendant la recherche', () => {
    expect(chatPhaseLabel('searching', 'Recherche : « fibrillation atriale »')).toBe(
      'Recherche : « fibrillation atriale »',
    );
  });

  it('ignore un détail vide ou absent', () => {
    expect(chatPhaseLabel('searching', '   ')).toBe(chatPhaseView('searching').label);
    expect(chatPhaseLabel('searching', null)).toBe(chatPhaseView('searching').label);
  });

  it("n'affiche jamais un nom d'outil pendant le raisonnement ou la rédaction", () => {
    expect(chatPhaseLabel('thinking', 'web_search')).toBe(chatPhaseView('thinking').label);
    expect(chatPhaseLabel('writing', 'web_search')).toBe(chatPhaseView('writing').label);
  });
});

describe('isPhaseDone — pastilles du chemin parcouru', () => {
  it('marque franchies les étapes antérieures seulement', () => {
    expect(isPhaseDone('thinking', 'writing')).toBe(true);
    expect(isPhaseDone('searching', 'writing')).toBe(true);
    expect(isPhaseDone('writing', 'writing')).toBe(false); // en cours ≠ franchie
    expect(isPhaseDone('searching', 'thinking')).toBe(false);
  });

  it('ne marque rien pendant une reprise (hors progression)', () => {
    for (const step of CHAT_PHASE_ORDER) {
      expect(isPhaseDone(step, 'recovering')).toBe(false);
    }
  });
});

describe('monotonicProgress — l’anneau ne recule jamais', () => {
  it('avance quand la phase avance', () => {
    const a = monotonicProgress(0, 'thinking');
    const b = monotonicProgress(a, 'searching');
    const c = monotonicProgress(b, 'writing');
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
  });

  it('retient la valeur atteinte si le flux renvoie une phase antérieure', () => {
    // Cas réel : un appel d'outil annoncé après les premiers fragments de texte.
    const atWriting = chatPhaseView('writing').progress;
    expect(monotonicProgress(atWriting, 'searching')).toBe(atWriting);
    expect(monotonicProgress(atWriting, 'thinking')).toBe(atWriting);
  });

  it('une reprise ne fait pas reculer un anneau déjà avancé', () => {
    const atWriting = chatPhaseView('writing').progress;
    expect(monotonicProgress(atWriting, 'recovering')).toBe(atWriting);
  });
});
