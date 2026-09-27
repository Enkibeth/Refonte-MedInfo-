/**
 * Forme RÉELLE des requêtes envoyées aux fournisseurs (2026-09).
 *
 * Les tests de featureRuntime vérifient les options que NOUS construisons ; ceux-ci les font
 * passer dans le vrai SDK (@ai-sdk/openai, @ai-sdk/anthropic) avec un `fetch` factice qui
 * capture le corps HTTP puis coupe l'appel. On vérifie ainsi ce que l'API recevrait —
 * c'est là que se cachaient les pièges des nouveaux modèles :
 *  - GPT-6 inconnu du SDK installé : sans `forceReasoning`, l'effort était jeté en silence ;
 *  - Claude 5 inconnu du SDK installé : sortie plafonnée à 4 096 tokens et repli JSON par
 *    outil FORCÉ, refusé par Opus 5.5 (400).
 * Aucun appel réseau. `generateText`/`generateObject` construisent le même corps que
 * `streamText` (même `getArgs` côté provider), au champ `stream` près.
 */
import { describe, it, expect } from 'vitest';
import { generateObject, generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';

import {
  CLAUDE_GEN5_MAX_OUTPUT_TOKENS,
  resolveFeatureRuntime,
  type FeatureRuntimeOverrides,
} from '@/ai/providers/featureRuntime';
import type { FeatureSettings } from '@/ai/providers/featureModel';

type Captured = { url: string; body: Record<string, any> };

/** `fetch` qui enregistre la requête puis échoue : rien ne sort de la machine. */
function captureFetch(): { calls: Captured[]; fetch: typeof fetch } {
  const calls: Captured[] = [];
  const fake = async (url: unknown, init?: { body?: unknown }) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body ?? '{}')) });
    throw new Error('requête capturée (test hors réseau)');
  };
  return { calls, fetch: fake as unknown as typeof fetch };
}

function settings(partial: Partial<FeatureSettings> & Pick<FeatureSettings, 'modelId' | 'provider'>): FeatureSettings {
  return { temperature: null, reasoningEffort: null, verbosity: null, webSearch: false, ...partial };
}

const schema = z.object({ ok: z.boolean() });

async function openaiBody(s: FeatureSettings, overrides: FeatureRuntimeOverrides = {}) {
  const { calls, fetch } = captureFetch();
  const provider = createOpenAI({ apiKey: 'sk-test', fetch });
  const { options } = resolveFeatureRuntime(s, overrides);
  await generateText({
    model: provider(s.modelId),
    system: 'PROMPT SYSTÈME',
    prompt: 'Question',
    maxRetries: 0,
    ...options,
  }).catch(() => undefined);
  expect(calls).toHaveLength(1);
  return calls[0];
}

async function anthropicBody(
  s: FeatureSettings,
  mode: 'text' | 'object',
  overrides: FeatureRuntimeOverrides = {},
) {
  const { calls, fetch } = captureFetch();
  const provider = createAnthropic({ apiKey: 'sk-ant-test', fetch });
  // Les routes generateObject retirent les outils (web_search) des options : même chose ici.
  const { tools, ...options } = resolveFeatureRuntime(s, overrides).options;
  const common = { model: provider(s.modelId), system: 'PROMPT SYSTÈME', prompt: 'Question', maxRetries: 0 };
  if (mode === 'object') {
    await generateObject({ ...common, ...options, schema }).catch(() => undefined);
  } else {
    await generateText({ ...common, ...options, ...(tools ? { tools } : {}) }).catch(() => undefined);
  }
  expect(calls).toHaveLength(1);
  return calls[0];
}

// Config actuelle de la feature `chat` en base (effort low, verbosité medium, recherche web).
const CHAT = { reasoningEffort: 'low', verbosity: 'medium', webSearch: true } as const;

describe('OpenAI GPT-6 Luna — requête réellement émise (API Responses)', () => {
  it('grand public, mode Classique : effort none, rôle developer, verbosité, recherche web', async () => {
    const { url, body } = await openaiBody(
      settings({ modelId: 'gpt-6-luna', provider: 'openai', ...CHAT }),
      { capReasoningEffort: 'minimal' },
    );
    expect(url).toMatch(/\/responses$/);
    expect(body.model).toBe('gpt-6-luna');
    expect(body.reasoning).toEqual({ effort: 'none' });
    expect(body.text).toEqual({ verbosity: 'medium' });
    expect(body.input[0]).toMatchObject({ role: 'developer' });
    expect(body.tools).toEqual([expect.objectContaining({ type: 'web_search', search_context_size: 'medium' })]);
    expect(body).not.toHaveProperty('temperature');
  });

  it('étudiant/pro, mode Approfondi : effort high, verbosité high', async () => {
    const { body } = await openaiBody(
      settings({ modelId: 'gpt-6-luna', provider: 'openai', ...CHAT }),
      { reasoningEffort: 'high', verbosity: 'high', maxOutputTokens: 4096 },
    );
    expect(body.reasoning).toEqual({ effort: 'high' });
    expect(body.text).toEqual({ verbosity: 'high' });
    expect(body.max_output_tokens).toBe(4096);
  });

  it('mode Rapide : effort none, verbosité low, aucun outil', async () => {
    const { body } = await openaiBody(
      settings({ modelId: 'gpt-6-luna', provider: 'openai', ...CHAT }),
      { reasoningEffort: 'minimal', verbosity: 'low', maxOutputTokens: 3000, webSearch: false },
    );
    expect(body.reasoning).toEqual({ effort: 'none' });
    expect(body.text).toEqual({ verbosity: 'low' });
    expect(body.tools).toBeUndefined();
  });

  it("témoin : SANS forceReasoning, le SDK installé jette l'effort de GPT-6 (raison d'être du contournement)", async () => {
    // Si ce test casse après une mise à jour de @ai-sdk/openai, c'est que le SDK reconnaît
    // désormais GPT-6 : `openaiNeedsForcedReasoning` peut alors être retiré.
    const { calls, fetch } = captureFetch();
    const provider = createOpenAI({ apiKey: 'sk-test', fetch });
    await generateText({
      model: provider('gpt-6-luna'),
      system: 'PROMPT SYSTÈME',
      prompt: 'Question',
      maxRetries: 0,
      providerOptions: { openai: { reasoningEffort: 'none' } },
    }).catch(() => undefined);
    expect(calls[0].body.reasoning).toBeUndefined();
    expect(calls[0].body.input[0]).toMatchObject({ role: 'system' });
  });

  it('garde anti-régression : le chat actuel (gpt-5.6-luna) émet la même requête qu\'avant', async () => {
    const { body } = await openaiBody(
      settings({ modelId: 'gpt-5.6-luna', provider: 'openai', ...CHAT }),
      { capReasoningEffort: 'minimal' },
    );
    expect(body.reasoning).toEqual({ effort: 'none' });
    expect(body.text).toEqual({ verbosity: 'medium' });
    expect(body.input[0]).toMatchObject({ role: 'developer' });
  });
});

describe('Anthropic Claude 5 — requête réellement émise (API Messages)', () => {
  it('Sonnet 5 + generateObject, effort réglé : adaptatif, effort, format JSON natif, aucun outil forcé', async () => {
    const { body } = await anthropicBody(
      settings({ modelId: 'claude-sonnet-5', provider: 'anthropic', reasoningEffort: 'minimal' }),
      'object',
    );
    expect(body.thinking).toEqual({ type: 'adaptive' });
    expect(body.output_config).toMatchObject({ effort: 'low', format: { type: 'json_schema' } });
    expect(body.max_tokens).toBe(CLAUDE_GEN5_MAX_OUTPUT_TOKENS);
    expect(body.tool_choice).toBeUndefined();
    expect(body.tools).toBeUndefined();
    expect(body).not.toHaveProperty('temperature');
  });

  it('Opus 5.5 + generateObject, rien de réglé : pas de tool_choice forcé (400 sur Opus 5.5), format JSON natif', async () => {
    const { body } = await anthropicBody(settings({ modelId: 'claude-opus-5-5', provider: 'anthropic' }), 'object');
    expect(body.tool_choice).toBeUndefined();
    expect(body.output_config).toMatchObject({ format: { type: 'json_schema' } });
    expect(body.output_config.effort).toBeUndefined();
    expect(body.thinking).toBeUndefined();
    expect(body.max_tokens).toBe(CLAUDE_GEN5_MAX_OUTPUT_TOKENS);
  });

  it('Opus 5.5 + texte + recherche web : outil web_search_20250305, effort, jamais de budget_tokens', async () => {
    const { body } = await anthropicBody(
      settings({ modelId: 'claude-opus-5-5', provider: 'anthropic', reasoningEffort: 'medium', webSearch: true }),
      'text',
    );
    expect(body.thinking).toEqual({ type: 'adaptive' });
    expect(body.output_config).toEqual({ effort: 'medium' });
    expect(body.tools).toEqual([expect.objectContaining({ type: 'web_search_20250305', max_uses: 3 })]);
  });

  it('Opus 4.8 avec effort : adaptatif (et non plus budget fixe, refusé par l\'API)', async () => {
    const { body } = await anthropicBody(
      settings({ modelId: 'claude-opus-4-8', provider: 'anthropic', reasoningEffort: 'high' }),
      'text',
    );
    expect(body.thinking).toEqual({ type: 'adaptive' });
    expect(body.output_config).toEqual({ effort: 'high' });
  });

  it('garde anti-régression : Sonnet 4.6 sans réglage (15 fonctions en prod) — requête inchangée', async () => {
    const { body } = await anthropicBody(settings({ modelId: 'claude-sonnet-4-6', provider: 'anthropic' }), 'object');
    expect(body.thinking).toBeUndefined();
    expect(body.output_config).toMatchObject({ format: { type: 'json_schema' } });
    expect(body.output_config.effort).toBeUndefined();
    expect(body.max_tokens).toBe(128_000);
    expect(body.tool_choice).toBeUndefined();
  });
});
