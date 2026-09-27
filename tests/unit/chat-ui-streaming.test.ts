import { describe, expect, it } from 'vitest';
import { createSubmissionGate } from '@/chat/submission';
import { advanceStreamingBody, EMPTY_STREAMING_BODY, visibleStreamingTail } from '@/chat/streamingBody';
import { phaseFromParts, streamingSources } from '@/ai/chat/statusPhases';
import { archiveMatchesTurn } from '@/chat/resume';

describe('reprise du même tour', () => {
  const user = { role: 'user', content: 'Question de test' };
  const answer = { role: 'assistant', content: 'Texte de test complet.' };
  it('accepte la réponse du tour en attente, y compris avant le premier fragment', () => {
    expect(archiveMatchesTurn([user], [user, answer])).toBe(true);
    expect(archiveMatchesTurn([user, { ...answer, content: 'Texte de test' }], [user, answer])).toBe(true);
  });
  it('refuse une archive en retard, une autre question et une régénération différente', () => {
    expect(archiveMatchesTurn([user, answer, user], [user, answer])).toBe(false);
    expect(archiveMatchesTurn([{ ...user, content: 'Autre question' }], [user, answer])).toBe(false);
    expect(archiveMatchesTurn([user, { ...answer, content: 'Une autre réponse.' }], [user, answer])).toBe(false);
    expect(archiveMatchesTurn([user], [user])).toBe(false);
    const common = 'Une introduction commune suffisamment longue pour dépasser soixante caractères. ';
    expect(archiveMatchesTurn([user, { ...answer, content: common + 'Nouvelle réponse' }], [user, { ...answer, content: common + 'Ancienne réponse plus longue' }])).toBe(false);
  });
});

describe('envoi immédiat et interruption', () => {
  it('verrouille avant toute attente et ignore une ancienne préparation après Arrêter', () => {
    const gate = createSubmissionGate();
    const first = gate.begin()!;
    expect(gate.begin()).toBeNull();
    gate.cancel();
    const next = gate.begin()!;
    expect(gate.current(first)).toBe(false);
    gate.finish(first);
    expect(gate.current(next)).toBe(true);
    gate.finish(next);
    expect(gate.begin()).not.toBeNull();
  });
});
describe('phases fondées sur le flux', () => {
  it('ne déduit pas une rédaction de la réception du raisonnement', () => {
    expect(phaseFromParts([{ type: 'reasoning', text: '…' }])).toBe('thinking');
    expect(phaseFromParts([{ type: 'tool-calculator', state: 'input-available' }])).toBe('thinking');
  });
  it('distingue une recherche commencée, terminée, échouée et du texte', () => {
    expect(phaseFromParts([{ type: 'tool-web_search', state: 'input-available' }])).toBe('searching');
    expect(phaseFromParts([{ type: 'dynamic-tool', toolName: 'web_search', state: 'output-available' }])).toBe('writing');
    expect(phaseFromParts([{ type: 'tool-web_search', state: 'output-error' }])).toBe('thinking');
    expect(phaseFromParts([{ type: 'text', text: 'Bonjour' }, { type: 'tool-web_search' }])).toBe('writing');
  });
  it('ne fabrique pas de référence et filtre les URL non navigables', () => {
    expect(streamingSources([{ type: 'tool-web_search' }])).toEqual([]);
    expect(streamingSources([{ type: 'source-url', url: 'https://example.org', title: 'Référence' }, { type: 'source-url', url: 'https://example.org' }, { type: 'source-url', url: 'javascript:alert(1)' }])).toEqual([{ url: 'https://example.org', title: 'Référence' }]);
  });
});
describe('rendu incrémental', () => {
  it('garde les blocs clos stables à chaque caractère et diffère les sections interactives', () => {
    const input = 'Une introduction.\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n```text\nun\n\ndeux\n```\n\nSOURCES\nSRC1 :: Référence';
    let state = EMPTY_STREAMING_BODY;
    for (let n = 1; n <= input.length; n++) {
      const prev = state;
      state = advanceStreamingBody(prev, input.slice(0, n), false);
      expect(state.chunks.slice(0, prev.chunks.length)).toEqual(prev.chunks);
    }
    expect(state.chunks).toHaveLength(3);
    expect(state.chunks[1]).toContain('| 1 | 2 |');
    expect(state.chunks[2]).toContain('un\n\ndeux');
    expect(state.deferred).toBe('SOURCES\nSRC1 :: Référence');
  });
  it('termine le dernier paragraphe sans perdre de texte et réinitialise une régénération', () => {
    let state = advanceStreamingBody(EMPTY_STREAMING_BODY, 'Début\n\nFin', false);
    expect(state.pending).toBe('Fin');
    state = advanceStreamingBody(state, state.source, true);
    expect(state.chunks.join('')).toBe('Début\n\nFin');
    expect(advanceStreamingBody(state, 'Nouvelle réponse', true).chunks).toEqual(['Nouvelle réponse']);
  });
  it('retient les syntaxes incomplètes et les blocs à largeur variable', () => {
    expect(visibleStreamingTail('| A |')).toBe('');
    expect(visibleStreamingTail('```medinfo-diagram\n{')).toBe('');
    expect(visibleStreamingTail('Voir [texte](https://ex')).toBe('Voir ');
    expect(visibleStreamingTail('Un **mot')).toBe('Un ');
    expect(visibleStreamingTail('Un **mot**.')).toBe('Un **mot**.');
    expect(visibleStreamingTail('SOUR')).toBe('');
    expect(visibleStreamingTail('Une référence (SRC')).toBe('Une référence ');
  });
});
