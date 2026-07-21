import { describe, it, expect } from 'vitest';

import {
  aggregateCosts,
  costUsd,
  groupUsage,
  hasPricing,
  MODEL_PRICING,
} from '@/admin/cost';

describe('cost — pricing', () => {
  it('coût = tokens × prix / 1M, additionne in et out', () => {
    // 1M in @1.25 + 1M out @10 = 11.25
    expect(costUsd('gpt-5.2', 1_000_000, 1_000_000)).toBeCloseTo(11.25, 6);
  });

  it('modèle inconnu ou "none" → coût 0 et non tarifé', () => {
    expect(hasPricing('none')).toBe(false);
    expect(hasPricing('modele-bidon')).toBe(false);
    expect(costUsd('none', 5000, 5000)).toBe(0);
  });

  it('tous les modèles tarifés ont des prix positifs ou nuls cohérents', () => {
    for (const [, p] of Object.entries(MODEL_PRICING)) {
      expect(p.inputPerM).toBeGreaterThanOrEqual(0);
      expect(p.outputPerM).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('cost — groupUsage', () => {
  it('groupe par persona × modèle et somme les tokens, robuste aux nulls', () => {
    const rows = groupUsage([
      { persona: 'professional', model_used: 'gpt-5.2', tokens_in: 100, tokens_out: 10 },
      { persona: 'professional', model_used: 'gpt-5.2', tokens_in: 50, tokens_out: null },
      { persona: 'public', model_used: 'none', tokens_in: null, tokens_out: null },
    ]);
    const pro = rows.find((r) => r.persona === 'professional' && r.model === 'gpt-5.2')!;
    expect(pro.requests).toBe(2);
    expect(pro.tokensIn).toBe(150);
    expect(pro.tokensOut).toBe(10);
    const pub = rows.find((r) => r.persona === 'public')!;
    expect(pub.model).toBe('none');
    expect(pub.tokensIn).toBe(0);
  });
});

describe('cost — aggregateCosts', () => {
  it('agrège par chatbot, trie par coût décroissant et signale les modèles sans prix', () => {
    const summary = aggregateCosts([
      { persona: 'public', model: 'gpt-5.2', requests: 1, tokensIn: 1_000_000, tokensOut: 0 }, // 1.25
      { persona: 'professional', model: 'gpt-5.2', requests: 1, tokensIn: 2_000_000, tokensOut: 0 }, // 2.50
      { persona: 'public', model: 'none', requests: 1, tokensIn: 500, tokensOut: 500 }, // non tarifé
    ]);
    // Pro (2.50) avant public (1.25) : tri par coût décroissant.
    expect(summary.chatbots[0].persona).toBe('professional');
    expect(summary.totalCostUsd).toBeCloseTo(3.75, 6);
    // Le public a un modèle "none" avec des tokens → hasUnpriced.
    const pub = summary.chatbots.find((c) => c.persona === 'public')!;
    expect(pub.hasUnpriced).toBe(true);
    expect(summary.hasUnpriced).toBe(true);
  });

  it('résumé vide sur entrée vide', () => {
    const summary = aggregateCosts([]);
    expect(summary.chatbots).toEqual([]);
    expect(summary.totalCostUsd).toBe(0);
    expect(summary.hasUnpriced).toBe(false);
  });
});
