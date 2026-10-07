import { describe, it, expect } from 'vitest';

import { elapsedLabel, inFlightAssistant } from '@/ai/chat/progress';
import { buildResearchTimeline } from '@/ai/chat/researchTimeline';

describe('inFlightAssistant — la trace ne doit jamais être celle du tour précédent', () => {
  const user = (text: string) => ({ role: 'user', parts: [{ type: 'text', text }] });
  const assistant = (tools: string[]) => ({
    role: 'assistant',
    parts: tools.map((t) => ({ type: `tool-${t}` })),
  });

  it('renvoie le message assistant en cours (dernier du fil)', () => {
    const messages = [user('q1'), assistant(['web_search']), user('q2'), assistant(['europe_pmc_search'])];
    expect(inFlightAssistant(messages)).toBe(messages[3]);
  });

  it('renvoie null juste après l’envoi : la réponse précédente n’est PAS en cours', () => {
    // C'est exactement le bug signalé : « Vérification des liens (2) » de la réponse
    // d'avant s'affichait pendant l'attente, puis basculait d'un coup.
    const messages = [user('q1'), assistant(['web_search', 'verify_source_links']), user('q2')];
    expect(inFlightAssistant(messages)).toBeNull();
    // Rien du tour précédent : seule l'analyse de la NOUVELLE question est en cours.
    const view = buildResearchTimeline(inFlightAssistant(messages)?.parts);
    expect(view.steps.map((s) => s.title)).toEqual(['Analyse de la question']);
    expect(view.searchCount).toBe(0);
  });

  it('supporte un fil vide ou une entrée invalide', () => {
    expect(inFlightAssistant([])).toBeNull();
    expect(inFlightAssistant(undefined)).toBeNull();
    expect(inFlightAssistant(null)).toBeNull();
  });
});

describe('elapsedLabel — l’attente chiffrée', () => {
  it('n’affiche rien sous la seconde (pas de compteur qui clignote à 0)', () => {
    expect(elapsedLabel(0)).toBe('');
    expect(elapsedLabel(999)).toBe('');
  });
  it('arrondit vers le bas, sans décimale', () => {
    expect(elapsedLabel(1000)).toBe('1 s');
    expect(elapsedLabel(12_800)).toBe('12 s');
    expect(elapsedLabel(59_999)).toBe('59 s');
  });
  it('bascule en minutes au-delà de 60 s', () => {
    expect(elapsedLabel(60_000)).toBe('1 min');
    expect(elapsedLabel(95_000)).toBe('1 min 35 s');
    expect(elapsedLabel(120_000)).toBe('2 min');
  });
  it('ne casse pas sur une entrée absurde', () => {
    expect(elapsedLabel(Number.NaN)).toBe('');
    expect(elapsedLabel(-500)).toBe('');
    expect(elapsedLabel(Number.POSITIVE_INFINITY)).toBe('');
  });
});
