import { describe, it, expect } from 'vitest';

import {
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
    const parts = [
      { type: 'tool-europe_pmc_search' },
      { type: 'text', text: '...' },
      { type: 'tool-europe_pmc_article' },
      { type: 'tool-europe_pmc_article' },
      { type: 'tool-verify_source_links' },
    ];
    const steps = summarizeChatProgress(parts);
    expect(steps.map((s) => s.tool)).toEqual([
      'europe_pmc_search',
      'europe_pmc_article',
      'verify_source_links',
    ]);
    expect(steps.find((s) => s.tool === 'europe_pmc_article')?.count).toBe(2);
    expect(steps.find((s) => s.tool === 'europe_pmc_search')?.count).toBe(1);
  });

  it('mappe vers des libellés lisibles, repli sur le nom brut si outil inconnu', () => {
    const steps = summarizeChatProgress([
      { type: 'tool-europe_pmc_search' },
      { type: 'tool-outil_inconnu' },
    ]);
    expect(steps[0].label).toBe(CHAT_PROGRESS_LABELS.europe_pmc_search);
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
