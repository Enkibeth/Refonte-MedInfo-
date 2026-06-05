import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// L'étage 2 appelle un LLM réel via @ai-sdk/anthropic ; on le mocke pour tester la
// logique (sélection de modèle, temperature=0, fail-closed) SANS appel réseau.
const generateObjectMock = vi.fn();
vi.mock('ai', () => ({
  generateObject: (...args: unknown[]) => generateObjectMock(...args),
}));
vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: (id: string) => ({ __model: id }),
}));

import {
  CLASSIFIER_STAGE2_MODEL_ID,
  CLASSIFIER_STAGE2_PROMPT,
  createLlmStage2,
  isStage2Configured,
  resolveStage2ModelId,
} from '@/ai/classifier/llmStage2';
import { classifyIntent } from '@/ai/classifier';

const ENV_KEYS = ['ANTHROPIC_API_KEY', 'CLASSIFIER_STAGE2_ENABLED', 'CLASSIFIER_MODEL_ID'] as const;
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  generateObjectMock.mockReset();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

describe('étage 2 — modèle peu coûteux par défaut', () => {
  it('utilise Claude Haiku 4.5 (le Claude le moins cher/rapide)', () => {
    delete process.env.CLASSIFIER_MODEL_ID;
    expect(CLASSIFIER_STAGE2_MODEL_ID).toBe('claude-haiku-4-5');
    expect(resolveStage2ModelId()).toBe('claude-haiku-4-5');
  });

  it('permet de surcharger le modèle via CLASSIFIER_MODEL_ID', () => {
    process.env.CLASSIFIER_MODEL_ID = 'claude-sonnet-4-6';
    expect(resolveStage2ModelId()).toBe('claude-sonnet-4-6');
  });
});

describe('étage 2 — prompt de classification (contrat 07_CLASSIFIER §4)', () => {
  it('porte l’asymétrie et les 5 catégories', () => {
    expect(CLASSIFIER_STAGE2_PROMPT).toContain('classifieur de sécurité');
    expect(CLASSIFIER_STAGE2_PROMPT).toContain('"emergency"');
    expect(CLASSIFIER_STAGE2_PROMPT).toContain('"personal_symptoms"');
    expect(CLASSIFIER_STAGE2_PROMPT).toContain('"general_info"');
    expect(CLASSIFIER_STAGE2_PROMPT).toContain('"out_of_scope"');
    expect(CLASSIFIER_STAGE2_PROMPT).toContain('"ambiguous"');
    expect(CLASSIFIER_STAGE2_PROMPT).toContain('ASYMÉTRIE');
  });
});

describe('étage 2 — appel LLM', () => {
  it('appelle generateObject avec le modèle Haiku et temperature=0', async () => {
    generateObjectMock.mockResolvedValue({ object: { category: 'general_info', confidence: 0.96 } });
    const stage2 = createLlmStage2();

    const verdict = await stage2("qu'est-ce que l'hypertension ?");

    expect(verdict).toEqual({ category: 'general_info', confidence: 0.96 });
    expect(generateObjectMock).toHaveBeenCalledTimes(1);
    const callArg = generateObjectMock.mock.calls[0][0] as Record<string, unknown>;
    expect(callArg.temperature).toBe(0);
    expect(callArg.model).toEqual({ __model: 'claude-haiku-4-5' });
    expect(callArg.system).toBe(CLASSIFIER_STAGE2_PROMPT);
  });

  it('FAIL-CLOSED : toute erreur LLM renvoie ambiguous/0 (refus par sécurité)', async () => {
    generateObjectMock.mockRejectedValue(new Error('timeout réseau'));
    const stage2 = createLlmStage2();

    const verdict = await stage2('formulation neutre non couverte par le lexique');

    expect(verdict).toEqual({ category: 'ambiguous', confidence: 0 });
  });
});

describe('étage 2 — intégration avec classifyIntent (defense-in-depth)', () => {
  it('le regex court-circuite l’étage 2 sur un marqueur personnel explicite', async () => {
    generateObjectMock.mockResolvedValue({ object: { category: 'general_info', confidence: 0.99 } });
    const stage2 = createLlmStage2();

    const out = await classifyIntent("j'ai mal au ventre", { llmStage2: stage2 });

    expect(generateObjectMock).not.toHaveBeenCalled();
    expect(out.category).toBe('personal_symptoms');
  });

  it('l’étage 2 rattrape une question générale non couverte par le regex', async () => {
    generateObjectMock.mockResolvedValue({ object: { category: 'general_info', confidence: 0.94 } });
    const stage2 = createLlmStage2();

    const out = await classifyIntent('quelle est la différence entre angine et pharyngite', {
      llmStage2: stage2,
    });

    expect(out.category).toBe('general_info');
    expect(out.layer).toBe('llm');
  });
});

describe('étage 2 — câblage conditionnel fail-closed', () => {
  it('non configuré sans clé Anthropic', () => {
    delete process.env.ANTHROPIC_API_KEY;
    process.env.CLASSIFIER_STAGE2_ENABLED = 'true';
    expect(isStage2Configured()).toBe(false);
  });

  it('non configuré si explicitement désactivé', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    process.env.CLASSIFIER_STAGE2_ENABLED = 'false';
    expect(isStage2Configured()).toBe(false);
  });

  it('configuré avec clé présente et activation par défaut', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    delete process.env.CLASSIFIER_STAGE2_ENABLED;
    expect(isStage2Configured()).toBe(true);
  });
});
