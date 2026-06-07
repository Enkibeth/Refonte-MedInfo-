import { afterEach, describe, expect, it, vi } from 'vitest';

import { logInteraction } from '@/ai/logging/logInteraction';
import { screenConversation } from '@/ai/orchestrator';

vi.mock('@/ai/routing/serverPersona', () => ({
  CHAT_PERSONAS: ['public', 'student'],
  resolveChatPersona: vi.fn(async (_request: Request, requested: unknown) => ({
    persona: 'public',
    requested,
    verified: false,
    attemptedElevation: requested === 'student',
  })),
}));

vi.mock('@/ai/rateLimit/chatRateLimit', () => ({
  checkChatRateLimit: vi.fn(async () => ({
    allowed: true,
    dailyLimit: 10,
    remaining: 9,
    resetAt: '2026-06-07T00:00:00.000Z',
  })),
}));

vi.mock('@/ai/orchestrator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/ai/orchestrator')>();
  return {
    ...actual,
    screenConversation: vi.fn(async () => ({ allowed: false, category: 'ambiguous' })),
  };
});

vi.mock('@/ai/logging/logInteraction', () => ({
  logInteraction: vi.fn(async () => undefined),
}));

vi.mock('@/ai/classifier/llmStage2', () => ({
  // Étage 2 = Gemini : non configuré dans ce test → undefined (fail-safe regex-seul).
  getStage2Classifier: vi.fn(() => undefined),
  createLlmStage2: vi.fn(),
}));

vi.mock('@/rag/retrieval', () => ({
  retrieveRagContext: vi.fn(),
  buildRagSystemSection: vi.fn(),
  RAG_REFUSAL_MESSAGE: 'Réponse impossible sans source fiable.',
}));

vi.mock('@/ai/providers/index', () => ({
  getActiveModel: vi.fn(),
  getActiveModelId: vi.fn(() => 'test-model'),
}));

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    streamText: vi.fn(),
    convertToModelMessages: vi.fn(async () => []),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/chat — edge cases API', () => {
  it('renvoie 400 sur JSON invalide avant safe-box et logging', async () => {
    const { POST } = await import('../../app/api/chat+api');

    const response = await POST(
      new Request('https://medinfo.test/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{not-json',
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid JSON' });
    expect(screenConversation).not.toHaveBeenCalled();
    expect(logInteraction).not.toHaveBeenCalled();
  });

  it('traite un body sans tableau messages comme conversation vide et refuse fail-safe', async () => {
    const { POST } = await import('../../app/api/chat+api');

    const response = await POST(
      new Request('https://medinfo.test/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona: 'public', messages: 'forged' }),
      }),
    );

    expect(response.status).toBe(200);
    expect(screenConversation).toHaveBeenCalledWith([], {
      allowFictiveEducationalCases: false,
      llmStage2: undefined,
    });
    expect(logInteraction).toHaveBeenCalledWith(expect.objectContaining({
      persona: 'public',
      model_used: 'none',
      refusal_triggered: true,
      guardrail_layer: 'classifier',
      intent_category: 'ambiguous',
    }));
  });
});
