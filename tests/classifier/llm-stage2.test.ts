import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Étage 2 du classifieur (07_CLASSIFIER §2-4) — deuxième lecture LLM.
 * On vérifie le câblage par environnement et le fail-safe absolu (jamais fail-open).
 * Le SDK `ai` est mocké : aucun appel réseau réel.
 */
const generateObjectMock = vi.fn();

vi.mock('ai', () => ({
  generateObject: (...args: unknown[]) => generateObjectMock(...args),
}));

vi.mock('@/ai/providers/index', () => ({
  getClassifierModel: () => ({ id: 'gemini-2.5-flash-lite-mock' }),
}));

import { createLlmStage2, getStage2Classifier } from '@/ai/classifier/llmStage2';

const ORIGINAL_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  else process.env.GOOGLE_GENERATIVE_AI_API_KEY = ORIGINAL_KEY;
  generateObjectMock.mockReset();
});

describe('getStage2Classifier — câblage conditionnel à la clé Gemini', () => {
  it('retourne undefined sans clé (fail-safe historique conservé)', () => {
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    expect(getStage2Classifier()).toBeUndefined();
  });

  it('retourne une fonction d’étage 2 quand la clé est configurée', () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-key';
    expect(typeof getStage2Classifier()).toBe('function');
  });
});

describe('createLlmStage2 — verdict et fail-safe', () => {
  it('relaie le verdict du LLM (general_info récupéré)', async () => {
    generateObjectMock.mockResolvedValueOnce({
      object: { category: 'general_info', confidence: 0.93 },
    });
    const stage2 = createLlmStage2();
    const verdict = await stage2('quelle est la posologie usuelle de référence ?');
    expect(verdict).toEqual({ category: 'general_info', confidence: 0.93 });
  });

  it('retombe sur ambiguous (refus) si le LLM échoue — jamais fail-open', async () => {
    generateObjectMock.mockRejectedValueOnce(new Error('LLM indisponible'));
    const stage2 = createLlmStage2();
    const verdict = await stage2('formulation neutre');
    expect(verdict).toEqual({ category: 'ambiguous', confidence: 0 });
  });
});
