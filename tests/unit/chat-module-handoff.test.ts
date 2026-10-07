import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  HANDOFF_TTL_MS,
  handoffForAction,
  offerHandoff,
  resetHandoffs,
  subscribeHandoff,
  takeHandoff,
  type HandoffFile,
} from '@/chat/moduleHandoff';
import { filtersForRequest } from '@/ecos/dashboard';
import { findScoreForRequest } from '@/scores';

const file: HandoffFile = { name: 'promo.xlsx', size: 10, type: '', arrayBuffer: async () => new ArrayBuffer(0) };

afterEach(() => resetHandoffs());

describe('relais chat → outil', () => {
  it('une demande est reprise UNE fois, par l’outil visé seulement', () => {
    offerHandoff({ tool: 'partiel', file }, 1000);
    expect(takeHandoff('scores', 1000)).toBeNull();
    expect(takeHandoff('partiel', 1000)).toEqual({ tool: 'partiel', file });
    expect(takeHandoff('partiel', 1000)).toBeNull();
  });

  it('une demande oubliée expire', () => {
    offerHandoff({ tool: 'scores', query: 'HAS-BLED' }, 0);
    expect(takeHandoff('scores', HANDOFF_TTL_MS + 1)).toBeNull();
  });

  it('prévient un écran déjà monté, et seulement le sien', () => {
    const partiel = vi.fn();
    const scores = vi.fn();
    const stop = subscribeHandoff('partiel', partiel);
    subscribeHandoff('scores', scores);
    offerHandoff({ tool: 'partiel', file });
    expect(partiel).toHaveBeenCalledTimes(1);
    expect(scores).not.toHaveBeenCalled();
    stop();
    offerHandoff({ tool: 'partiel', file });
    expect(partiel).toHaveBeenCalledTimes(1);
  });

  it('carte d’action → demande déposée seulement si elle porte un paramètre utile', () => {
    expect(handoffForAction({ tool: 'scores', param: 'HAS-BLED' })).toEqual({ tool: 'scores', query: 'HAS-BLED' });
    expect(handoffForAction({ tool: 'ecos', param: 'Gériatrie' })).toEqual({ tool: 'ecos', query: 'Gériatrie' });
    expect(handoffForAction({ tool: 'presentation', param: 'Insuffisance cardiaque' })).toEqual({
      tool: 'presentation',
      topic: 'Insuffisance cardiaque',
    });
    expect(handoffForAction({ tool: 'scores', param: null })).toBeNull();
    expect(handoffForAction({ tool: 'revision', param: null })).toBeNull();
  });
});

describe('outils récepteurs : lecture de la demande', () => {
  it('Scores : sigle exact, aux indices et tirets près', () => {
    expect(findScoreForRequest('CHA2DS2-VASc')?.id).toBe('cha2ds2-vasc');
    expect(findScoreForRequest('has bled')?.id).toBe('has-bled');
    expect(findScoreForRequest('child-pugh')?.id).toBe('child-pugh');
    expect(findScoreForRequest('')).toBeNull();
  });

  it('Scores : demande ambiguë → pas de score ouvert au hasard', () => {
    expect(findScoreForRequest('embolie pulmonaire')).toBeNull();
  });

  it('ECOS : thème exact, sinon recherche (casse et accents ignorés)', () => {
    const themes = ['Cardiologie · Urgences', 'Gériatrie', 'Pneumologie · Cardiologie'];
    expect(filtersForRequest('geriatrie', themes)).toEqual({ theme: 'Gériatrie', query: '' });
    expect(filtersForRequest('Cardiologie', themes)).toEqual({ theme: null, query: 'Cardiologie' });
    expect(filtersForRequest('  ', themes)).toEqual({ theme: null, query: '' });
  });
});
