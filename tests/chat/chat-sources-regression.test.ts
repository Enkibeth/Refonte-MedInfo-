import { describe, expect, it } from 'vitest';

import { collectLatestCitations } from '@/ai/ui/chatSources';

describe('UI chat — collectLatestCitations régressions', () => {
  it('prend le dernier appel show_sources dans le dernier message pertinent', () => {
    const oldCitation = { title: 'Ancienne source', emitter: 'HAS' };
    const firstInLatest = { title: 'Première source du dernier message', emitter: 'ANSM' };
    const lastInLatest = { title: 'Dernière source du dernier message', emitter: 'HAS' };

    expect(
      collectLatestCitations([
        {
          id: 'old',
          role: 'assistant',
          parts: [{ type: 'tool-show_sources', output: { citations: [oldCitation] } }],
        } as any,
        {
          id: 'latest',
          role: 'assistant',
          parts: [
            { type: 'tool-show_sources', output: { citations: [firstInLatest] } },
            { type: 'tool-propose_followups', output: { suggestions: ['Résumer'] } },
            { toolName: 'show_sources', output: { citations: [lastInLatest] } },
          ],
        } as any,
      ]),
    ).toEqual([lastInLatest]);
  });

  it('ignore un show_sources mal formé et continue vers une source antérieure valide', () => {
    const validCitation = { title: 'Source valide', emitter: 'HAS', url: 'https://has-sante.fr' };

    expect(
      collectLatestCitations([
        {
          id: 'valid',
          role: 'assistant',
          parts: [{ type: 'tool-show_sources', output: { citations: [validCitation] } }],
        } as any,
        {
          id: 'malformed',
          role: 'assistant',
          parts: [{ type: 'tool-show_sources', output: { citations: null } }],
        } as any,
      ]),
    ).toEqual([validCitation]);
  });
});
