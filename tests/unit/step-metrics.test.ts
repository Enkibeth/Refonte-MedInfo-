import { describe, it, expect } from 'vitest';

import { summarizeSteps } from '@/ai/logging/stepMetrics';

describe('summarizeSteps — instrumentation de la boucle agentique (migration 0034)', () => {
  it('compte les étapes et les appels par outil depuis step.toolCalls', () => {
    const out = summarizeSteps([
      {
        toolCalls: [
          { toolName: 'europe_pmc_search' },
          { toolName: 'europe_pmc_search' },
        ],
      },
      { toolCalls: [{ toolName: 'europe_pmc_article' }, { toolName: 'europe_pmc_article' }] },
      { toolCalls: [{ toolName: 'verify_source_links' }] },
      { toolCalls: [] }, // rédaction finale, sans outil
    ]);
    expect(out).toEqual({
      steps: 4,
      toolCalls: {
        europe_pmc_search: 2,
        europe_pmc_article: 2,
        verify_source_links: 1,
      },
    });
  });

  it('retombe sur les parts tool-call du contenu (outils exécutés par le provider)', () => {
    const out = summarizeSteps([
      {
        content: [
          { type: 'tool-call', toolName: 'web_search' },
          { type: 'text', text: 'réponse' },
        ],
      },
    ]);
    expect(out).toEqual({ steps: 1, toolCalls: { web_search: 1 } });
  });

  it('réponse directe sans outil → 1 étape, aucun appel', () => {
    expect(summarizeSteps([{ toolCalls: [] }])).toEqual({ steps: 1, toolCalls: {} });
  });

  it('null pour une forme inexploitable (jamais une exception)', () => {
    expect(summarizeSteps(undefined)).toBeNull();
    expect(summarizeSteps([])).toBeNull();
    expect(summarizeSteps('pas un tableau')).toBeNull();
    // Étapes malformées ignorées sans crash.
    expect(summarizeSteps([null, { toolCalls: 'oops' }, { toolCalls: [{ toolName: 42 }] }])).toEqual({
      steps: 3,
      toolCalls: {},
    });
  });
});
