import { describe, expect, it } from 'vitest';
import { createSubmissionGate } from '@/chat/submission';
import { advanceStreamingBody, EMPTY_STREAMING_BODY, visibleStreamingTail } from '@/chat/streamingBody';
import { archiveMatchesTurn } from '@/chat/resume';
import { parseAssistantMessage, type ParsedBlock } from '@/ai/chat/parseAssistantMessage';
import { CHAT_ANSWER_FIXTURES, STUDENT_BODY_FOLLOWUPS, STUDENT_REAL_FORMAT } from './helpers/chatAnswerFixtures';

/** Rejoue un texte caractère par caractère, comme le flux, et renvoie chaque état. */
function replay(text: string) {
  const states = [];
  let state = EMPTY_STREAMING_BODY;
  for (let n = 1; n <= text.length; n++) {
    state = advanceStreamingBody(state, text.slice(0, n), false);
    states.push(state);
  }
  return { states, final: advanceStreamingBody(state, text, true) };
}

const squash = (text: string) => text.replace(/\s+/g, ' ').trim();
const bodyText = (blocks: ParsedBlock[]) =>
  squash(blocks.map((b) => (b.type === 'body' ? b.markdown : '')).join('\n'));
const structured = (blocks: ParsedBlock[]) => blocks.filter((b) => b.type !== 'body');

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

describe('rendu incrémental — forme réelle des réponses', () => {
  const MARKER = /\[1\]\s*\+\s*\[2\]/;
  const SECTION_LINE = /^(?:#{1,6}\s*)?(?:SOURCES|APPROFONDISSEMENTS|QUESTIONS_PATIENT|INTERACTION|AUTO-RÉFLEXION)\s*$/m;

  for (const [name, text] of Object.entries(CHAT_ANSWER_FIXTURES)) {
    describe(name, () => {
      const { states, final } = replay(text);

      it('blocs clos stables à chaque caractère, sans titre de section, CALC ni marqueur', () => {
        let previous: readonly string[] = [];
        for (const state of states) {
          expect(state.chunks.slice(0, previous.length)).toEqual(previous);
          previous = state.chunks;
        }
        for (const chunk of final.chunks) {
          expect(chunk).not.toMatch(SECTION_LINE);
          expect(chunk).not.toMatch(/<!--|SRC\d+ ::/);
          expect(chunk).not.toMatch(MARKER);
        }
      });

      it('le bloc ouvert ne montre jamais une syntaxe incomplète ou technique', () => {
        for (const state of states) {
          const tail = visibleStreamingTail(state.pending);
          expect(tail).not.toMatch(MARKER);
          expect(tail).not.toMatch(/^\s*(?:\||```|<!--)/m);
          expect(tail.split('**').length % 2).toBe(1);
          expect(tail.split('`').length % 2).toBe(1);
          expect(tail.split('(').length).toBe(tail.split(')').length);
          expect(tail).not.toMatch(/\]\([^)]*$|\[[^\]]*$/);
          const lastLine = tail.slice(tail.lastIndexOf('\n') + 1).trim();
          expect(lastLine).not.toMatch(/^(?:#{1,6}\s*)?(?:SOUR|APPRO|INTERAC|AUTO-R|QUESTIONS_P)/);
        }
      });

      it('le rendu final en direct équivaut au rendu relu depuis l’historique', () => {
        expect(advanceStreamingBody(EMPTY_STREAMING_BODY, text, true)).toEqual(final);
        const history = parseAssistantMessage(text).blocks;
        const deferred = final.deferred === null ? [] : parseAssistantMessage(final.deferred).blocks;
        expect(squash(`${final.chunks.join('')}\n${bodyText(deferred)}`)).toBe(bodyText(history));
        expect(structured(deferred)).toEqual(structured(history));
      });
    });
  }

  it('titre `### SOURCES` : la section et les relances qui la suivent sont différées', () => {
    const { final } = replay(STUDENT_REAL_FORMAT);
    expect(final.deferred?.startsWith('### SOURCES\n')).toBe(true);
    expect(final.chunks.join('')).toContain('### FIABILITÉ');
  });

  it('relances dans le corps : la liste reste ouverte puis part avec le marqueur, jamais close puis retirée', () => {
    const { states, final } = replay(STUDENT_BODY_FOLLOWUPS);
    for (const state of states) expect(state.chunks.join('')).not.toContain('Question A');
    expect(final.chunks).toEqual(['Réponse courte de test.\n\n']);
    expect(final.deferred).toBe('1. Question A ?\n2. Question B ?\n3. Question C ?\n\n[1] + [2] + [3]');
    // Pendant l'attente de la ligne suivante, la liste reste lisible dans le bloc ouvert.
    const waiting = advanceStreamingBody(EMPTY_STREAMING_BODY, 'Intro.\n\n1. Un\n2. Deux\n\n[1', false);
    expect(visibleStreamingTail(waiting.pending)).toBe('1. Un\n2. Deux\n\n');
  });

  it('une liste numérotée ordinaire se ferme dès que la ligne suivante est du texte', () => {
    const state = advanceStreamingBody(EMPTY_STREAMING_BODY, 'Intro.\n\n1. Un\n2. Deux\n\nS', false);
    expect(state.chunks).toEqual(['Intro.\n\n', '1. Un\n2. Deux\n\n']);
    const done = advanceStreamingBody(EMPTY_STREAMING_BODY, 'Intro.\n\n1. Un\n2. Deux\n\n', true);
    expect(done.chunks.join('')).toBe('Intro.\n\n1. Un\n2. Deux\n\n');
    expect(done.deferred).toBeNull();
  });

  it('appels de note, liens et marqueurs partiels attendent leur forme finale', () => {
    expect(visibleStreamingTail('Selon la source (SRC1, SRC')).toBe('Selon la source ');
    expect(visibleStreamingTail('Selon (Classe I · SRC1')).toBe('Selon ');
    expect(visibleStreamingTail('Selon SR')).toBe('Selon ');
    expect(visibleStreamingTail('Dose [à vérifier] chez l’adulte')).toBe('Dose [à vérifier] chez l’adulte');
    expect(visibleStreamingTail('Voir ([exemple.org](https://example.org/a')).toBe('Voir ');
    expect(visibleStreamingTail('Voir [exemple.org]')).toBe('Voir ');
    expect(visibleStreamingTail('Texte.\n### SOUR')).toBe('Texte.\n');
    expect(visibleStreamingTail('Texte.\n**SOURCES')).toBe('Texte.\n');
    expect(visibleStreamingTail('Texte.\n-')).toBe('Texte.\n');
    expect(visibleStreamingTail('Texte.\n<')).toBe('Texte.\n');
    expect(visibleStreamingTail('Texte.\n``')).toBe('Texte.\n');
    expect(visibleStreamingTail('Intro :\n| A | B |\n|---|')).toBe('Intro :\n');
    expect(visibleStreamingTail('Texte.\n### Souffle')).toBe('Texte.\n### Souffle');
    expect(visibleStreamingTail('< 50 kg')).toBe('< 50 kg');
  });
});
