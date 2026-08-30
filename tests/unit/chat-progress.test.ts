import { describe, it, expect } from 'vitest';

import {
  elapsedLabel,
  inFlightAssistant,
  summarizeChatProgress,
  toolNameOfPart,
  CHAT_PROGRESS_LABELS,
} from '@/ai/chat/progress';

describe('toolNameOfPart', () => {
  it('extrait le nom d’un part `tool-<name>`', () => {
    expect(toolNameOfPart({ type: 'tool-europe_pmc_search' })).toBe('europe_pmc_search');
    expect(toolNameOfPart({ type: 'tool-verify_source_links' })).toBe('verify_source_links');
  });

  it('extrait le nom d’un part `dynamic-tool` via toolName', () => {
    expect(toolNameOfPart({ type: 'dynamic-tool', toolName: 'web_search' })).toBe('web_search');
  });

  it('renvoie null pour un part non-outil ou malformé', () => {
    expect(toolNameOfPart({ type: 'text' })).toBeNull();
    expect(toolNameOfPart({ type: 'tool-' })).toBeNull();
    expect(toolNameOfPart({ type: 'dynamic-tool' })).toBeNull();
    expect(toolNameOfPart({})).toBeNull();
  });
});

describe('summarizeChatProgress', () => {
  it('renvoie une trace vide hors tableau ou sans outil', () => {
    expect(summarizeChatProgress(null)).toEqual([]);
    expect(summarizeChatProgress([{ type: 'text', text: 'coucou' }])).toEqual([]);
  });

  it('ordonne par première apparition et compte les appels par outil', () => {
    // Le chat n'a plus qu'un outil (la recherche web du provider, ADR-0037) ; le module
    // reste générique et doit continuer à ordonner/compter n'importe quel nom d'outil.
    const parts = [
      { type: 'tool-web_search' },
      { type: 'text', text: '...' },
      { type: 'tool-autre_outil' },
      { type: 'tool-autre_outil' },
    ];
    const steps = summarizeChatProgress(parts);
    expect(steps.map((s) => s.tool)).toEqual(['web_search', 'autre_outil']);
    expect(steps.find((s) => s.tool === 'autre_outil')?.count).toBe(2);
    expect(steps.find((s) => s.tool === 'web_search')?.count).toBe(1);
  });

  it('mappe vers des libellés lisibles, repli sur le nom brut si outil inconnu', () => {
    const steps = summarizeChatProgress([
      { type: 'tool-web_search' },
      { type: 'tool-outil_inconnu' },
    ]);
    expect(steps[0].label).toBe(CHAT_PROGRESS_LABELS.web_search);
    expect(steps[1].label).toBe('outil_inconnu');
  });

  it('gère les parts `dynamic-tool` (web_search exécuté par le provider)', () => {
    const steps = summarizeChatProgress([
      { type: 'dynamic-tool', toolName: 'web_search' },
      { type: 'dynamic-tool', toolName: 'web_search' },
    ]);
    expect(steps).toHaveLength(1);
    expect(steps[0].count).toBe(2);
    expect(steps[0].label).toBe(CHAT_PROGRESS_LABELS.web_search);
  });
});

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
    expect(summarizeChatProgress(inFlightAssistant(messages)?.parts)).toEqual([]);
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
