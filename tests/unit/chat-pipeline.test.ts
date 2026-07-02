import { describe, expect, it, vi } from 'vitest';

import { runChatPipeline, type ChatPipelineInput } from '@/ai/chat/pipeline';
import type { GuardMode } from '@/ai/chat/guard/config';
import type { ChatRateLimitResult } from '@/ai/rateLimit/chatRateLimit';
import { CANONICAL_REFUSAL } from '@/compliance/disclosures';

function baseInput(overrides: Partial<ChatPipelineInput> = {}): ChatPipelineInput {
  return {
    request: new Request('http://localhost/api/chat', { method: 'POST' }),
    uiMessages: [{ role: 'user', parts: [{ type: 'text', text: 'Qu’est-ce que l’hypertension artérielle ?' }] }],
    chatbot: 'public',
    resolution: {
      persona: 'public',
      verified: true,
      userId: 'user-1',
      requested: 'public',
      attemptedElevation: false,
    },
    personalInfo: null,
    conversationId: 'conv-1',
    startMs: Date.now(),
    ...overrides,
  };
}

function allowedLimit(): ChatRateLimitResult {
  return {
    allowed: true,
    status: 'ok',
    dailyCount: 1,
    dailyLimit: 10,
    remaining: 9,
    resetAt: new Date(Date.now() + 3_600_000).toISOString(),
    identityType: 'user',
  };
}

type StreamTextOptions = { onFinish?: (arg: { text: string; usage?: { inputTokens?: number; outputTokens?: number } }) => Promise<void> | void };

function fakeDeps() {
  const logs: unknown[] = [];
  const saved: unknown[] = [];
  let streamOptions: StreamTextOptions | null = null;
  const rateLimit = vi.fn(async () => allowedLimit());
  const deps = {
    guardMode: (() => 'enforce') as () => GuardMode,
    createGuardLlmCheck: () => undefined,
    checkChatRateLimit: rateLimit as never,
    getPromptTemplate: async () => 'PROMPT',
    getRuntimeForFeature: (async () => ({
      model: {},
      modelId: 'test-model',
      provider: 'openai',
      settings: {},
      options: {},
    })) as never,
    streamTextImpl: ((options: StreamTextOptions) => {
      streamOptions = options;
      return {
        consumeStream: () => undefined,
        toUIMessageStreamResponse: () => new Response('MAIN_STREAM'),
      };
    }) as never,
    saveAssistantMessage: (async (_supabase: unknown, entry: unknown) => {
      saved.push(entry);
    }) as never,
    createSupabase: (() => ({})) as never,
    logInteraction: (async (entry: unknown) => {
      logs.push(entry);
    }) as never,
    now: () => Date.now(),
  };
  return { deps, logs, saved, rateLimit, getStreamOptions: () => streamOptions };
}

describe('runChatPipeline — ADR-0029', () => {
  it('urgence en mode enforce : refus streamé, archivé, loggé — et le quota N’EST PAS consommé', async () => {
    const { deps, logs, saved, rateLimit } = fakeDeps();
    const res = await runChatPipeline(
      baseInput({ uiMessages: [{ role: 'user', parts: [{ type: 'text', text: 'J’ai une douleur thoracique là maintenant' }] }] }),
      deps,
    );
    const body = await res.text();
    expect(body).toContain('MedInfo AI fournit');
    expect(body).toContain('15 (SAMU)');
    expect(rateLimit).not.toHaveBeenCalled();
    expect(saved).toHaveLength(1);
    expect((saved[0] as { content: string }).content).toContain(CANONICAL_REFUSAL);
    expect(logs[0]).toMatchObject({
      refusal_triggered: true,
      guardrail_layer: 'classifier',
      intent_category: 'emergency',
    });
  });

  it('quota atteint : 429 avec reset_at et header Retry-After', async () => {
    const { deps } = fakeDeps();
    const resetAt = new Date(Date.now() + 1_800_000).toISOString();
    deps.checkChatRateLimit = (async () => ({
      allowed: false,
      status: 'limited',
      dailyCount: 11,
      dailyLimit: 10,
      remaining: 0,
      resetAt,
      identityType: 'user',
    })) as never;
    const res = await runChatPipeline(baseInput(), deps);
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0);
    const body = (await res.json()) as { error: string; reset_at: string };
    expect(body.error).toBe('rate_limited');
    expect(body.reset_at).toBe(resetAt);
  });

  it('chemin nominal : stream renvoyé, archivage + log réels dans onFinish', async () => {
    const { deps, logs, saved, getStreamOptions } = fakeDeps();
    const res = await runChatPipeline(baseInput(), deps);
    expect(await res.text()).toBe('MAIN_STREAM');
    await getStreamOptions()!.onFinish!({ text: 'Réponse.', usage: { inputTokens: 10, outputTokens: 20 } });
    expect(saved).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      refusal_triggered: false,
      guardrail_layer: 'none',
      intent_category: 'general_info',
      model_used: 'test-model',
    });
  });

  it('mode log (observation) : un message bloquant PASSE mais est journalisé « aurait refusé »', async () => {
    const { deps, logs, rateLimit, getStreamOptions } = fakeDeps();
    deps.guardMode = () => 'log' as const;
    const res = await runChatPipeline(
      baseInput({ uiMessages: [{ role: 'user', parts: [{ type: 'text', text: 'J’ai de la fièvre depuis 3 jours, c’est grave ?' }] }] }),
      deps,
    );
    expect(await res.text()).toBe('MAIN_STREAM');
    expect(rateLimit).toHaveBeenCalled();
    await getStreamOptions()!.onFinish!({ text: 'Réponse.' });
    expect(logs[0]).toMatchObject({
      refusal_triggered: false,
      guardrail_layer: 'classifier',
      intent_category: 'personal_symptoms',
    });
  });

  it('mode off : la garde n’est jamais consultée (kill-switch ADR-0024)', async () => {
    const { deps } = fakeDeps();
    deps.guardMode = () => 'off' as const;
    const guardSpy = vi.fn();
    const res = await runChatPipeline(
      baseInput({ uiMessages: [{ role: 'user', parts: [{ type: 'text', text: 'J’ai une douleur thoracique là maintenant' }] }] }),
      { ...deps, runInputGuard: guardSpy as never },
    );
    expect(await res.text()).toBe('MAIN_STREAM');
    expect(guardSpy).not.toHaveBeenCalled();
  });

  it('vignette ECOS d’un étudiant vérifié : passe (exception fictive avant le verrou urgence)', async () => {
    const { deps } = fakeDeps();
    const res = await runChatPipeline(
      baseInput({
        chatbot: 'student',
        resolution: {
          persona: 'student',
          verified: true,
          userId: 'user-2',
          requested: 'student',
          attemptedElevation: false,
        },
        uiMessages: [
          {
            role: 'user',
            parts: [
              {
                type: 'text',
                text: 'Cas clinique fictif ECOS : patiente de 62 ans, douleur thoracique atypique. Démarche diagnostique ?',
              },
            ],
          },
        ],
      }),
      deps,
    );
    expect(await res.text()).toBe('MAIN_STREAM');
  });
});
