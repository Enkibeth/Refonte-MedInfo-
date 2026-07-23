import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { capReasoningEffort, getRuntimeForFeature } from '@/ai/providers/featureRuntime';
import { invalidateConfigCache } from '@/ai/providers/featureModel';

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
    expect(rt.settings.reasoningEffort).toBe('minimal');
    expect(rt.options.providerOptions?.openai?.reasoningEffort).toBe('minimal');
  });

  it("un plafond seul n'active aucun raisonnement quand rien n'est configuré", async () => {
    const rt = await getRuntimeForFeature('chat', { capReasoningEffort: 'minimal' });
    expect(rt.settings.reasoningEffort).toBeNull();
    expect(rt.options.providerOptions?.openai?.reasoningEffort).toBeUndefined();
  });

  it('sans plafond, la surcharge par requête reste prioritaire (comportement historique)', async () => {
    const rt = await getRuntimeForFeature('chat', { reasoningEffort: 'high' });
    expect(rt.settings.reasoningEffort).toBe('high');
  });

  it('split (audit 2026-07) : chercheur = gpt-5-mini, rédacteur (chat) = gpt-5.2', async () => {
    const researcher = await getRuntimeForFeature('chat_researcher', { webSearch: true });
    expect(researcher.modelId).toBe('gpt-5-mini');
    expect(researcher.provider).toBe('openai');
    const writer = await getRuntimeForFeature('chat');
    expect(writer.modelId).toBe('gpt-5.2');
  });
});
