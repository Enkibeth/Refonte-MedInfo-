import { describe, expect, it, vi } from 'vitest';

import { CANONICAL_REFUSAL } from '@/compliance/disclosures';
import { classifyIntent } from '@/ai/classifier';
import { resolveDecision } from '@/ai/classifier/decision';
import { runClassifierGate } from '@/ai/classifier/gate';
import type { ClassifierResult } from '@/ai/classifier/types';

const result = (category: ClassifierResult['category'], confidence = 0.99): ClassifierResult => ({
  category,
  confidence,
  layer: 'regex',
});

describe('resolveDecision — mapping catégorie → action', () => {
  it('route uniquement general_info vers le LLM principal', () => {
    const decision = resolveDecision(result('general_info', 0.9));
    expect(decision.action).toBe('route_main_llm');
    expect(decision.refusalMessage).toBeUndefined();
  });

  it.each(['personal_symptoms', 'emergency', 'ambiguous'] as const)(
    'refuse avec le message canonique pour %s',
    (category) => {
      const decision = resolveDecision(result(category));
      expect(decision.action).toBe('refuse');
      expect(decision.refusalMessage).toBe(CANONICAL_REFUSAL);
    },
  );

  it('répond hors-sujet poliment pour out_of_scope (sans refus médical)', () => {
    const decision = resolveDecision(result('out_of_scope'));
    expect(decision.action).toBe('out_of_scope_reply');
    expect(decision.refusalMessage).toBeUndefined();
  });

  it('refuse un general_info sous le seuil de confiance (ceinture + bretelles)', () => {
    const decision = resolveDecision(result('general_info', 0.5));
    expect(decision.action).toBe('refuse');
  });
});

describe('runClassifierGate — le LLM principal n’est JAMAIS appelé hors general_info', () => {
  it.each([
    "j'ai mal au ventre",
    'je ressens une douleur thoracique',
    'pour un ami, il a mal depuis 3 jours',
  ])('n’appelle pas le LLM principal pour "%s"', async (message) => {
    const callMainLlm = vi.fn(async () => 'NE DOIT PAS ÊTRE APPELÉ');
    const outcome = await runClassifierGate(message, { callMainLlm });

    expect(callMainLlm).not.toHaveBeenCalled();
    expect(outcome.action).toBe('refuse');
    expect(outcome.refusalMessage).toBe(CANONICAL_REFUSAL);
  });

  it('appelle le LLM principal pour une question encyclopédique', async () => {
    const callMainLlm = vi.fn(async () => 'réponse encyclopédique');
    const outcome = await runClassifierGate("qu'est-ce que l'hypertension ?", { callMainLlm });

    expect(callMainLlm).toHaveBeenCalledTimes(1);
    expect(outcome.action).toBe('route_main_llm');
  });
});

describe('classifyIntent — fail-safe sans étage 2', () => {
  it('retombe sur ambiguous quand le regex ne tranche pas et qu’aucun étage 2 n’est fourni', async () => {
    const out = await classifyIntent('blarg foo qwerty');
    expect(out.category).toBe('ambiguous');
    expect(out.layer).toBe('fallback');
  });

  it('utilise l’étage 2 injecté quand le regex ne tranche pas', async () => {
    const llmStage2 = vi.fn(async () => ({ category: 'general_info' as const, confidence: 0.95 }));
    const out = await classifyIntent('une formulation neutre non couverte par le lexique', { llmStage2 });
    expect(llmStage2).toHaveBeenCalledTimes(1);
    expect(out.category).toBe('general_info');
    expect(out.layer).toBe('llm');
  });

  it('ne consulte jamais l’étage 2 quand le regex a déjà tranché un cas personnel', async () => {
    const llmStage2 = vi.fn(async () => ({ category: 'general_info' as const, confidence: 0.99 }));
    const out = await classifyIntent("j'ai mal au ventre", { llmStage2 });
    expect(llmStage2).not.toHaveBeenCalled();
    expect(out.category).toBe('personal_symptoms');
  });
});
