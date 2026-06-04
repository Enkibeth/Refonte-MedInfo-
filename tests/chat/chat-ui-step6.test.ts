import { describe, expect, it } from 'vitest';

import { collectLatestCitations } from '@/ai/ui/chatSources';

describe('étape 6 — UI chat sources/QCM helpers', () => {
  it('extrait les sources du dernier tool-call show_sources pour alimenter le toggle haut de chat', () => {
    const citations = [
      { title: 'HAS diabète type 2', emitter: 'HAS', url: 'https://www.has-sante.fr/x', excerpt: 'Parcours de soins' },
    ];

    expect(
      collectLatestCitations([
        { id: '1', role: 'assistant', parts: [{ type: 'tool-show_sources', state: 'output-available', output: { citations: [] } }] } as any,
        { id: '2', role: 'assistant', parts: [{ type: 'tool-show_sources', state: 'output-available', output: { citations } }] } as any,
      ]),
    ).toEqual(citations);
  });

  it('ignore les messages sans show_sources', () => {
    expect(
      collectLatestCitations([
        {
          id: 'qcm',
          role: 'assistant',
          parts: [
            {
              type: 'tool-render_qcm',
              state: 'output-available',
              output: { stem: 'Question', options: ['A', 'B', 'C', 'D', 'E'], correct_index: 0 },
            },
          ],
        } as any,
      ]),
    ).toEqual([]);
  });
});
