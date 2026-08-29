import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  capReasoningEffort,
  getRuntimeForFeature,
  openaiReasoningEffort,
} from '@/ai/providers/featureRuntime';
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

  it('split : chercheur = gpt-5.6-luna (2026-08), rédacteur (chat) = gpt-5.2', async () => {
    const researcher = await getRuntimeForFeature('chat_researcher', { webSearch: true });
    expect(researcher.modelId).toBe('gpt-5.6-luna');
    expect(researcher.provider).toBe('openai');
    // La RÉDACTION clinique reste sur le modèle fort : la bascule vers un tier économique
    // est un arbitrage qualité qui appartient à Hugo (panel admin), pas un défaut de code.
    const writer = await getRuntimeForFeature('chat');
    expect(writer.modelId).toBe('gpt-5.2');
  });

  it('mode Rapide : chat_fast = gpt-5.6-luna, sans recherche web', async () => {
    const fast = await getRuntimeForFeature('chat_fast');
    expect(fast.modelId).toBe('gpt-5.6-luna');
    expect(fast.settings.webSearch).toBe(false);
  });

  it("GPT-5.6 : l'effort `minimal` part en `none` dans les providerOptions", async () => {
    const rt = await getRuntimeForFeature('chat_fast', { reasoningEffort: 'minimal' });
    // Vocabulaire interne conservé…
    expect(rt.settings.reasoningEffort).toBe('minimal');
    // …mais c'est bien `none` qui est envoyé à l'API (`minimal` n'existe plus en 5.6).
    expect(rt.options.providerOptions?.openai?.reasoningEffort).toBe('none');
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
