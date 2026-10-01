import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  anthropicEffort,
  anthropicThinkingStyle,
  capReasoningEffort,
  CLAUDE_GEN5_MAX_OUTPUT_TOKENS,
  getRuntimeForFeature,
  isClaudeGeneration5,
  openaiNeedsForcedReasoning,
  openaiReasoningEffort,
  REASONING_OUTPUT_RESERVE,
  reasoningOutputReserve,
  resolveFeatureRuntime,
} from '@/ai/providers/featureRuntime';
import {
  AVAILABLE_MODELS,
  getModelCapabilities,
  invalidateConfigCache,
  type FeatureSettings,
} from '@/ai/providers/featureModel';

/** Réglages d'une fonctionnalité, par défaut « rien de réglé » (comme en base). */
function settings(partial: Partial<FeatureSettings> & Pick<FeatureSettings, 'modelId' | 'provider'>): FeatureSettings {
  return {
    temperature: null,
    reasoningEffort: null,
    verbosity: null,
    webSearch: false,
    ...partial,
  };
}

// ── Plafond d'effort de raisonnement (balance rapidité/qualité par chatbot) ─────

describe('capReasoningEffort — plafonne sans jamais relever', () => {
  it('abaisse un effort au-dessus du plafond', () => {
    expect(capReasoningEffort('high', 'minimal')).toBe('minimal');
    expect(capReasoningEffort('medium', 'low')).toBe('low');
  });

  it('conserve un effort déjà au niveau ou sous le plafond', () => {
    expect(capReasoningEffort('minimal', 'low')).toBe('minimal');
    expect(capReasoningEffort('low', 'low')).toBe('low');
  });

  it("ne relève jamais un effort absent (n'active pas de thinking non configuré)", () => {
    expect(capReasoningEffort(null, 'minimal')).toBeNull();
    expect(capReasoningEffort(null, 'high')).toBeNull();
  });
});

describe('getRuntimeForFeature — plafond par requête (chat public → minimal)', () => {
  beforeEach(() => {
    // Sans Supabase configuré, la config retombe sur FEATURE_DEFAULTS (chat = gpt-5.2,
    // effort null) : le test est déterministe.
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    invalidateConfigCache();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    invalidateConfigCache();
  });

  it("plafonne l'effort effectif et le propage aux providerOptions OpenAI", async () => {
    const rt = await getRuntimeForFeature('chat', {
      reasoningEffort: 'medium',
      capReasoningEffort: 'minimal',
    });
    // Vocabulaire interne conservé…
    expect(rt.settings.reasoningEffort).toBe('minimal');
    // …et traduit au bord : GPT-6 Luna (modèle du chat) n'a pas `minimal`.
    expect(rt.options.providerOptions?.openai?.reasoningEffort).toBe('none');
  });

  it("un plafond seul n'active aucun raisonnement quand rien n'est configuré", async () => {
    const rt = await getRuntimeForFeature('chat', { capReasoningEffort: 'minimal' });
    expect(rt.settings.reasoningEffort).toBeNull();
    expect(rt.options.providerOptions?.openai?.reasoningEffort).toBeUndefined();
    // Le mode « modèle à raisonnement » reste forcé pour GPT-6 (rôle developer).
    expect(rt.options.providerOptions?.openai?.forceReasoning).toBe(true);
  });

  it('sans plafond, la surcharge par requête reste prioritaire (comportement historique)', async () => {
    const rt = await getRuntimeForFeature('chat', { reasoningEffort: 'high' });
    expect(rt.settings.reasoningEffort).toBe('high');
  });

  it('retour à la base (ADR-0037) : le chat tourne sur un seul modèle, gpt-6-luna depuis 0046', async () => {
    const rt = await getRuntimeForFeature('chat');
    expect(rt.modelId).toBe('gpt-6-luna');
    expect(rt.provider).toBe('openai');
  });

  it("la température n'est jamais envoyée au modèle du chat (GPT-6 la refuse dès que l'effort n'est pas none)", async () => {
    const rt = await getRuntimeForFeature('chat');
    expect(rt.options.temperature).toBeUndefined();
  });

  it('la recherche web du provider est activable par requête (surcharge du mode)', async () => {
    const on = await getRuntimeForFeature('chat', { webSearch: true });
    expect(on.settings.webSearch).toBe(true);
    const off = await getRuntimeForFeature('chat', { webSearch: false });
    expect(off.settings.webSearch).toBe(false);
    expect(off.options.tools).toBeUndefined();
  });
});

// ── Traduction de l'effort de raisonnement selon le modèle OpenAI ───────────────

describe('openaiReasoningEffort — `minimal` n\'existe plus dans la famille GPT-5.6', () => {
  it('traduit minimal → none pour les modèles 5.6', () => {
    expect(openaiReasoningEffort('gpt-5.6-luna', 'minimal')).toBe('none');
    expect(openaiReasoningEffort('gpt-5.6-terra', 'minimal')).toBe('none');
    expect(openaiReasoningEffort('gpt-5.6-sol', 'minimal')).toBe('none');
  });

  it('laisse les autres efforts inchangés (low/medium/high existent en 5.6)', () => {
    expect(openaiReasoningEffort('gpt-5.6-luna', 'low')).toBe('low');
    expect(openaiReasoningEffort('gpt-5.6-luna', 'medium')).toBe('medium');
    expect(openaiReasoningEffort('gpt-5.6-luna', 'high')).toBe('high');
  });

  it("ne touche pas aux modèles des autres familles (gpt-5.2 accepte `minimal`)", () => {
    expect(openaiReasoningEffort('gpt-5.2', 'minimal')).toBe('minimal');
    expect(openaiReasoningEffort('gpt-5-mini', 'minimal')).toBe('minimal');
    // Pas de faux positif sur un futur `gpt-5.60` ou `gpt-5.61` hypothétique.
    expect(openaiReasoningEffort('gpt-5.61', 'minimal')).toBe('minimal');
  });
});

// ── GPT-6 (Sol / Luna) ──────────────────────────────────────────────────────────

describe('GPT-6 — traduction de l\'effort et mode raisonnement forcé', () => {
  it('minimal → none pour Sol et Luna (même comportement que la 5.6 pour le grand public)', () => {
    expect(openaiReasoningEffort('gpt-6-luna', 'minimal')).toBe('none');
    expect(openaiReasoningEffort('gpt-6-sol', 'minimal')).toBe('none');
    // Variante datée.
    expect(openaiReasoningEffort('gpt-6-luna-2026-09-01', 'minimal')).toBe('none');
  });

  it("minimal → low pour un GPT-6 sans `none` (Astra) — conseil du guide de migration OpenAI", () => {
    expect(openaiReasoningEffort('gpt-6-astra', 'minimal')).toBe('low');
  });

  it('les autres efforts passent tels quels', () => {
    expect(openaiReasoningEffort('gpt-6-luna', 'low')).toBe('low');
    expect(openaiReasoningEffort('gpt-6-luna', 'medium')).toBe('medium');
    expect(openaiReasoningEffort('gpt-6-sol', 'high')).toBe('high');
  });

  it('pas de faux positif sur un identifiant qui commence seulement par gpt-6', () => {
    expect(openaiReasoningEffort('gpt-60', 'minimal')).toBe('minimal');
    expect(openaiNeedsForcedReasoning('gpt-60')).toBe(false);
  });

  it('forceReasoning pour GPT-6 seulement (le SDK reconnaît déjà gpt-5.x)', () => {
    expect(openaiNeedsForcedReasoning('gpt-6-luna')).toBe(true);
    expect(openaiNeedsForcedReasoning('gpt-6-sol')).toBe(true);
    expect(openaiNeedsForcedReasoning('gpt-5.6-luna')).toBe(false);
    expect(openaiNeedsForcedReasoning('gpt-4o-mini')).toBe(false);
  });

  it('chat sur gpt-6-luna, grand public mode Classique : effort none, raisonnement forcé, verbosité, recherche web', () => {
    // Config actuelle de la feature `chat` en base, modèle remplacé par gpt-6-luna.
    const { settings: s, options } = resolveFeatureRuntime(
      settings({ modelId: 'gpt-6-luna', provider: 'openai', reasoningEffort: 'low', verbosity: 'medium', webSearch: true }),
      { capReasoningEffort: 'minimal' },
    );
    expect(s.reasoningEffort).toBe('minimal');
    expect(options.providerOptions).toEqual({
      openai: { forceReasoning: true, reasoningEffort: 'none', textVerbosity: 'medium' },
    });
    expect(options.tools?.web_search).toBeDefined();
    expect(options.temperature).toBeUndefined();
  });

  it("la température n'est jamais envoyée à GPT-6, même réglée en base", () => {
    const { options } = resolveFeatureRuntime(
      settings({ modelId: 'gpt-6-luna', provider: 'openai', temperature: 0.3 }),
    );
    expect(options.temperature).toBeUndefined();
  });
});

describe('garde anti-régression : la config ACTUELLE du chat (gpt-5.6-luna) ne change pas', () => {
  it('mêmes providerOptions qu\'avant (pas de forceReasoning, minimal → none)', () => {
    const { options } = resolveFeatureRuntime(
      settings({ modelId: 'gpt-5.6-luna', provider: 'openai', reasoningEffort: 'low', verbosity: 'medium', webSearch: true }),
      { capReasoningEffort: 'minimal' },
    );
    expect(options.providerOptions).toEqual({ openai: { reasoningEffort: 'none', textVerbosity: 'medium' } });
    expect(options.tools?.web_search).toBeDefined();
    expect(options.maxOutputTokens).toBeUndefined();
  });
});

// ── Claude : réflexion adaptative (4.6+ / génération 5) vs budget fixe ───────────

describe('Claude — style de réflexion par modèle', () => {
  it('adaptative pour la génération 5 et les Opus/Sonnet 4.6+', () => {
    expect(anthropicThinkingStyle('claude-sonnet-5')).toBe('adaptive');
    expect(anthropicThinkingStyle('claude-opus-5-5')).toBe('adaptive');
    expect(anthropicThinkingStyle('claude-opus-4-8')).toBe('adaptive');
    expect(anthropicThinkingStyle('claude-opus-4-7')).toBe('adaptive');
    expect(anthropicThinkingStyle('claude-sonnet-4-6')).toBe('adaptive');
  });

  it('budget fixe pour les modèles qui n\'ont que celui-là (Haiku 4.5, Sonnet 4.5)', () => {
    expect(anthropicThinkingStyle('claude-haiku-4-5-20251001')).toBe('budget');
    expect(anthropicThinkingStyle('claude-sonnet-4-5')).toBe('budget');
  });

  it('génération 5 : reconnue sans faux positif sur les versions 4.x', () => {
    expect(isClaudeGeneration5('claude-sonnet-5')).toBe(true);
    expect(isClaudeGeneration5('claude-opus-5-5')).toBe(true);
    expect(isClaudeGeneration5('claude-fable-5-1')).toBe(true);
    expect(isClaudeGeneration5('claude-opus-4-8')).toBe(false);
    expect(isClaudeGeneration5('claude-haiku-4-5-20251001')).toBe(false);
    expect(isClaudeGeneration5('gpt-5.6-luna')).toBe(false);
  });

  it('effort Anthropic : minimal → low, le reste tel quel', () => {
    expect(anthropicEffort('minimal')).toBe('low');
    expect(anthropicEffort('low')).toBe('low');
    expect(anthropicEffort('medium')).toBe('medium');
    expect(anthropicEffort('high')).toBe('high');
  });
});

describe('Claude — options d\'appel', () => {
  it('garde anti-régression : les 15 fonctions actuelles (Sonnet 4.6, rien de réglé) restent inchangées', () => {
    const { options } = resolveFeatureRuntime(settings({ modelId: 'claude-sonnet-4-6', provider: 'anthropic' }));
    expect(options).toEqual({});
    const withSearch = resolveFeatureRuntime(
      settings({ modelId: 'claude-sonnet-4-6', provider: 'anthropic', webSearch: true }),
    );
    expect(Object.keys(withSearch.options)).toEqual(['tools']);
  });

  it('Sonnet 5 sans effort réglé : défaut du modèle, plafond de sortie et sorties structurées natives', () => {
    const { options } = resolveFeatureRuntime(settings({ modelId: 'claude-sonnet-5', provider: 'anthropic' }));
    expect(options.providerOptions).toEqual({ anthropic: { structuredOutputMode: 'outputFormat' } });
    expect(options.maxOutputTokens).toBe(CLAUDE_GEN5_MAX_OUTPUT_TOKENS);
    expect(options.temperature).toBeUndefined();
  });

  it('Sonnet 5 avec effort : réflexion adaptative + effort (jamais budget_tokens, jamais de température)', () => {
    const { options } = resolveFeatureRuntime(
      settings({ modelId: 'claude-sonnet-5', provider: 'anthropic', reasoningEffort: 'minimal', temperature: 0.7 }),
    );
    expect(options.providerOptions).toEqual({
      anthropic: { thinking: { type: 'adaptive' }, effort: 'low', structuredOutputMode: 'outputFormat' },
    });
    expect(options.temperature).toBeUndefined();
    expect(options.maxOutputTokens).toBe(CLAUDE_GEN5_MAX_OUTPUT_TOKENS);
  });

  it('Opus 5.5 : mêmes règles (réflexion toujours active, effort par défaut du modèle si rien n\'est réglé)', () => {
    const none = resolveFeatureRuntime(settings({ modelId: 'claude-opus-5-5', provider: 'anthropic' }));
    expect(none.options.providerOptions).toEqual({ anthropic: { structuredOutputMode: 'outputFormat' } });
    const high = resolveFeatureRuntime(
      settings({ modelId: 'claude-opus-5-5', provider: 'anthropic', reasoningEffort: 'high', webSearch: true }),
    );
    expect(high.options.providerOptions?.anthropic).toMatchObject({ thinking: { type: 'adaptive' }, effort: 'high' });
    expect(high.options.tools?.web_search).toBeDefined();
  });

  it('Opus 4.8 avec effort : réflexion adaptative (le budget fixe y est refusé par l\'API)', () => {
    const { options } = resolveFeatureRuntime(
      settings({ modelId: 'claude-opus-4-8', provider: 'anthropic', reasoningEffort: 'medium' }),
    );
    expect(options.providerOptions).toEqual({ anthropic: { thinking: { type: 'adaptive' }, effort: 'medium' } });
    // Modèle connu du SDK : son plafond de sortie par défaut (128 000) s'applique.
    expect(options.maxOutputTokens).toBeUndefined();
  });

  it('Haiku 4.5 avec effort : budget fixe inchangé', () => {
    const { options } = resolveFeatureRuntime(
      settings({ modelId: 'claude-haiku-4-5-20251001', provider: 'anthropic', reasoningEffort: 'low' }),
    );
    expect(options.providerOptions).toEqual({ anthropic: { thinking: { type: 'enabled', budgetTokens: 2048 } } });
    expect(options.maxOutputTokens).toBe(2048 + 4096);
  });

  it('un plafond de sortie par requête plus bas ne tronque pas la réflexion d\'un Claude 5', () => {
    const { options } = resolveFeatureRuntime(
      settings({ modelId: 'claude-sonnet-5', provider: 'anthropic' }),
      { maxOutputTokens: 3000 },
    );
    expect(options.maxOutputTokens).toBe(CLAUDE_GEN5_MAX_OUTPUT_TOKENS);
  });
});

// ── Budget de sortie explicite = réponse visible ; la réflexion a sa propre réserve ──

describe('reasoningOutputReserve — la réflexion ne doit plus épuiser le budget de la réponse', () => {
  it('réserve croissante avec l\'effort, aucune pour minimal (aucune réflexion chez GPT-5.6/6)', () => {
    expect(REASONING_OUTPUT_RESERVE.minimal).toBe(0);
    expect(REASONING_OUTPUT_RESERVE.low).toBeLessThan(REASONING_OUTPUT_RESERVE.medium);
    expect(REASONING_OUTPUT_RESERVE.medium).toBeLessThan(REASONING_OUTPUT_RESERVE.high);
  });

  it('OpenAI à raisonnement : réserve de l\'effort effectif, effort par défaut (medium) si rien n\'est réglé', () => {
    const caps = { reasoning: true };
    expect(reasoningOutputReserve(settings({ modelId: 'gpt-6-luna', provider: 'openai', reasoningEffort: 'high' }), caps))
      .toBe(REASONING_OUTPUT_RESERVE.high);
    expect(reasoningOutputReserve(settings({ modelId: 'gpt-6-luna', provider: 'openai' }), caps))
      .toBe(REASONING_OUTPUT_RESERVE.medium);
  });

  it('aucune réserve pour un modèle sans raisonnement, ni pour Claude à budget fixe (plancher déjà posé)', () => {
    expect(reasoningOutputReserve(settings({ modelId: 'gpt-4o-mini', provider: 'openai', reasoningEffort: 'high' }), { reasoning: false }))
      .toBe(0);
    expect(
      reasoningOutputReserve(
        settings({ modelId: 'claude-haiku-4-5-20251001', provider: 'anthropic', reasoningEffort: 'high' }),
        { reasoning: true },
      ),
    ).toBe(0);
  });

  it('Claude adaptatif : réserve si la réflexion est active (effort réglé, ou génération 5 par défaut)', () => {
    const caps = { reasoning: true };
    expect(reasoningOutputReserve(settings({ modelId: 'claude-sonnet-4-6', provider: 'anthropic', reasoningEffort: 'high' }), caps))
      .toBe(REASONING_OUTPUT_RESERVE.high);
    expect(reasoningOutputReserve(settings({ modelId: 'claude-sonnet-4-6', provider: 'anthropic' }), caps)).toBe(0);
    expect(reasoningOutputReserve(settings({ modelId: 'claude-sonnet-5', provider: 'anthropic' }), caps))
      .toBe(REASONING_OUTPUT_RESERVE.medium);
  });

  it('chat Pro, mode Approfondi (gpt-6-luna, high, 4 096) : la réponse garde ses 4 096 tokens après la réflexion', () => {
    const { options } = resolveFeatureRuntime(
      settings({ modelId: 'gpt-6-luna', provider: 'openai', reasoningEffort: 'low', verbosity: 'medium', webSearch: true }),
      { reasoningEffort: 'high', verbosity: 'high', maxOutputTokens: 4096 },
    );
    expect(options.maxOutputTokens).toBe(4096 + REASONING_OUTPUT_RESERVE.high);
  });

  it('mode Rapide (effort minimal → none) : budget inchangé', () => {
    const { options } = resolveFeatureRuntime(
      settings({ modelId: 'gpt-6-luna', provider: 'openai', reasoningEffort: 'low', webSearch: true }),
      { reasoningEffort: 'minimal', verbosity: 'low', maxOutputTokens: 3000, webSearch: false },
    );
    expect(options.maxOutputTokens).toBe(3000);
  });

  it('Haiku 4.5 (budget fixe) : plancher budget + 4 096 conservé, sans réserve ajoutée', () => {
    const { options } = resolveFeatureRuntime(
      settings({ modelId: 'claude-haiku-4-5-20251001', provider: 'anthropic', reasoningEffort: 'low' }),
      { maxOutputTokens: 3000 },
    );
    expect(options.maxOutputTokens).toBe(2048 + 4096);
  });
});

describe('panel admin — nouveaux modèles et capacités', () => {
  it('GPT-6 Sol/Luna, Claude Sonnet 5 et Opus 5.5 sont proposés', () => {
    const ids = AVAILABLE_MODELS.map((m) => m.id);
    for (const id of ['gpt-6-sol', 'gpt-6-luna', 'claude-sonnet-5', 'claude-opus-5-5']) {
      expect(ids).toContain(id);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('capacités : jamais de température pour GPT-6 / Claude 5 / Opus 4.8 ; recherche web partout', () => {
    for (const id of ['gpt-6-sol', 'gpt-6-luna', 'claude-sonnet-5', 'claude-opus-5-5', 'claude-opus-4-8']) {
      const caps = getModelCapabilities(id);
      expect(caps.temperature, id).toBe(false);
      expect(caps.reasoning, id).toBe(true);
      expect(caps.webSearch, id).toBe(true);
    }
    expect(getModelCapabilities('gpt-6-luna').verbosity).toBe(true);
    expect(getModelCapabilities('claude-sonnet-5').verbosity).toBe(false);
  });
});
