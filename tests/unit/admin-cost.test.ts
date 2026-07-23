import { describe, it, expect } from 'vitest';

import {
  aggregateConversationCosts,
  aggregateCosts,
  costUsd,
  groupConversationUsage,
  groupUsage,
  hasPricing,
  MODEL_PRICING,
  providerOfModel,
  resolveModelPrice,
  webSearchCallsOf,
  webSearchCostUsd,
  WEB_SEARCH_PER_CALL_USD,
  CACHED_INPUT_DISCOUNT,
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

  it('cached tokens (item K) : la part cachée est tarifée au taux réduit, jamais au plein prix', () => {
    // 1M in dont 1M caché @1.25 : plein = 1.25, avec rabais 10% = 0.125.
    expect(costUsd('gpt-5.2', 1_000_000, 0, 1_000_000)).toBeCloseTo(1.25 * CACHED_INPUT_DISCOUNT, 6);
    // Mélange : 600k non caché + 400k caché = 0.6*1.25 + 0.4*1.25*0.1 = 0.75 + 0.05 = 0.80.
    expect(costUsd('gpt-5.2', 1_000_000, 0, 400_000)).toBeCloseTo(0.8, 6);
    // cached borné à tokensIn (jamais négatif).
    expect(costUsd('gpt-5.2', 1_000, 0, 999_999)).toBeCloseTo(1_000 * 1.25 * 0.1 / 1_000_000, 9);
  });

  it('web_search (item K) : facturation par appel selon le provider du modèle', () => {
    expect(providerOfModel('gpt-5.2')).toBe('openai');
    expect(providerOfModel('claude-sonnet-4-6')).toBe('anthropic');
    expect(providerOfModel('gemini-2.5-flash')).toBe('google');
    expect(webSearchCostUsd('gpt-5.2', 4)).toBeCloseTo(4 * WEB_SEARCH_PER_CALL_USD.openai, 9);
    expect(webSearchCostUsd('gemini-2.5-flash', 4)).toBe(0); // grounding Google compté 0
    expect(webSearchCostUsd('gpt-5.2', 0)).toBe(0);
    // Coût total = tokens + appels de recherche web.
    expect(costUsd('gpt-5.2', 1_000_000, 0, 0, 3)).toBeCloseTo(1.25 + 3 * WEB_SEARCH_PER_CALL_USD.openai, 6);
  });

  it('webSearchCallsOf : somme web_search + google_search, robuste aux formes', () => {
    expect(webSearchCallsOf({ web_search: 2, google_search: 1, europe_pmc_search: 5 })).toBe(3);
    expect(webSearchCallsOf(null)).toBe(0);
    expect(webSearchCallsOf('x')).toBe(0);
  });

  it('tous les modèles tarifés ont des prix positifs ou nuls cohérents', () => {
    for (const [, p] of Object.entries(MODEL_PRICING)) {
      expect(p.inputPerM).toBeGreaterThanOrEqual(0);
      expect(p.outputPerM).toBeGreaterThanOrEqual(0);
    }
  });

  it('résolution par famille : variantes non listées couvertes (mini/nano/pro/flash)', () => {
    expect(resolveModelPrice('gpt-5.2').source).toBe('exact');
    expect(resolveModelPrice('gpt-5.4-mini').source).toBe('family');
    expect(resolveModelPrice('gpt-5.4-nano').source).toBe('family');
    expect(resolveModelPrice('gpt-5.2-pro').source).toBe('family');
    expect(resolveModelPrice('gemini-2.5-flash-lite').source).toBe('exact');
    expect(resolveModelPrice('gemini-3-flash').source).toBe('family');
    expect(resolveModelPrice('claude-opus-9').source).toBe('family');
    // Un mini coûte moins qu'un flagship.
    expect(resolveModelPrice('gpt-5-mini').inputPerM).toBeLessThan(resolveModelPrice('gpt-5').inputPerM);
    // Whisper / inconnu : non résolu.
    expect(resolveModelPrice('whisper-1').source).toBe('unknown');
    expect(hasPricing('whisper-1')).toBe(false);
  });
});

describe('cost — groupUsage', () => {
  it('groupe par persona × modèle et somme les tokens, robuste aux nulls', () => {
    const rows = groupUsage([
      {
        persona: 'professional',
        model_used: 'gpt-5.2',
        tokens_in: 100,
        tokens_out: 10,
        cached_tokens_in: 40,
        tool_calls: { web_search: 2, europe_pmc_search: 3 },
      },
      { persona: 'professional', model_used: 'gpt-5.2', tokens_in: 50, tokens_out: null },
      { persona: 'public', model_used: 'none', tokens_in: null, tokens_out: null },
    ]);
    const pro = rows.find((r) => r.persona === 'professional' && r.model === 'gpt-5.2')!;
    expect(pro.requests).toBe(2);
    expect(pro.tokensIn).toBe(150);
    expect(pro.tokensOut).toBe(10);
    // Nouveaux compteurs (item K) : part cachée + appels de recherche web, robustes aux nulls.
    expect(pro.cachedTokensIn).toBe(40);
    expect(pro.webSearchCalls).toBe(2);
    const pub = rows.find((r) => r.persona === 'public')!;
    expect(pub.model).toBe('none');
    expect(pub.tokensIn).toBe(0);
    expect(pub.cachedTokensIn).toBe(0);
    expect(pub.webSearchCalls).toBe(0);
  });
});

describe('cost — aggregateCosts', () => {
  it('agrège par chatbot, trie par coût décroissant et signale les modèles sans prix', () => {
    const summary = aggregateCosts([
      { persona: 'public', model: 'gpt-5.2', requests: 1, tokensIn: 1_000_000, tokensOut: 0, cachedTokensIn: 0, webSearchCalls: 0 }, // 1.25
      { persona: 'professional', model: 'gpt-5.2', requests: 1, tokensIn: 2_000_000, tokensOut: 0, cachedTokensIn: 0, webSearchCalls: 0 }, // 2.50
      { persona: 'public', model: 'none', requests: 1, tokensIn: 500, tokensOut: 500, cachedTokensIn: 0, webSearchCalls: 0 }, // non tarifé
    ]);
    // Pro (2.50) avant public (1.25) : tri par coût décroissant.
    expect(summary.chatbots[0].persona).toBe('professional');
    expect(summary.totalCostUsd).toBeCloseTo(3.75, 6);
    // Le public a un modèle "none" avec des tokens → hasUnpriced.
    const pub = summary.chatbots.find((c) => c.persona === 'public')!;
    expect(pub.hasUnpriced).toBe(true);
    expect(summary.hasUnpriced).toBe(true);
  });

  it('intègre la facturation web_search et le rabais cached dans les totaux (item K)', () => {
    const summary = aggregateCosts([
      // 1M in dont 500k caché @1.25 = 0.5*1.25 + 0.5*1.25*0.1 = 0.625 + 0.0625 = 0.6875
      // + 3 recherches web × 0.01 = 0.03 → 0.7175
      { persona: 'professional', model: 'gpt-5.2', requests: 1, tokensIn: 1_000_000, tokensOut: 0, cachedTokensIn: 500_000, webSearchCalls: 3 },
    ]);
    const pro = summary.chatbots[0];
    expect(pro.webSearchCostUsd).toBeCloseTo(0.03, 6);
    expect(pro.cachedTokensIn).toBe(500_000);
    expect(pro.costUsd).toBeCloseTo(0.7175, 6);
    expect(summary.totalWebSearchCostUsd).toBeCloseTo(0.03, 6);
    expect(summary.totalCachedTokensIn).toBe(500_000);
    expect(pro.models[0].webSearchCostUsd).toBeCloseTo(0.03, 6);
  });

  it('résumé vide sur entrée vide', () => {
    const summary = aggregateCosts([]);
    expect(summary.chatbots).toEqual([]);
    expect(summary.totalCostUsd).toBe(0);
    expect(summary.totalWebSearchCostUsd).toBe(0);
    expect(summary.totalCachedTokensIn).toBe(0);
    expect(summary.hasUnpriced).toBe(false);
  });
});

describe('cost — par conversation', () => {
  it('groupe par conversation × modèle, ignore les lignes sans conversation_id', () => {
    const rows = groupConversationUsage([
      { conversation_id: 'c1', persona: 'professional', model_used: 'gpt-5.2', tokens_in: 1000, tokens_out: 100, created_at: '2026-07-01T10:00:00Z' },
      { conversation_id: 'c1', persona: 'chat_meta', model_used: 'gemini-2.5-flash', tokens_in: 200, tokens_out: 20, created_at: '2026-07-01T10:01:00Z' },
      { conversation_id: null, persona: 'analyze', model_used: 'claude-sonnet-4-6', tokens_in: 500, tokens_out: 50, created_at: '2026-07-01T09:00:00Z' },
    ]);
    // 2 lignes (c1 × 2 modèles) ; la ligne sans conversation_id est ignorée.
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.conversationId === 'c1')).toBe(true);
  });

  it('agrège une conversation multi-modèles et trie par coût décroissant', () => {
    const convs = aggregateConversationCosts([
      { conversationId: 'cheap', persona: 'public', model: 'gpt-5.2', requests: 1, tokensIn: 100_000, tokensOut: 0, cachedTokensIn: 0, webSearchCalls: 0, lastAt: '2026-07-01T10:00:00Z' },
      { conversationId: 'pricey', persona: 'professional', model: 'gpt-5.2', requests: 1, tokensIn: 2_000_000, tokensOut: 0, cachedTokensIn: 0, webSearchCalls: 0, lastAt: '2026-07-02T10:00:00Z' },
      { conversationId: 'pricey', persona: 'professional', model: 'gemini-2.5-flash', requests: 1, tokensIn: 100_000, tokensOut: 0, cachedTokensIn: 0, webSearchCalls: 0, lastAt: '2026-07-02T10:05:00Z' },
    ]);
    expect(convs[0].conversationId).toBe('pricey');
    // pricey = 2M×1.25 (gpt) + 0.1M×0.30 (gemini) = 2.53
    expect(convs[0].costUsd).toBeCloseTo(2.53, 4);
    expect(convs[0].requests).toBe(2);
    // Dernière activité = le max des deux.
    expect(convs[0].lastAt).toBe('2026-07-02T10:05:00Z');
  });
});
