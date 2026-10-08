import { beforeEach, describe, expect, it, vi } from 'vitest';

const { resolvePersona, quota, generate, fetchMock, runtime } = vi.hoisted(() => ({
  resolvePersona: vi.fn(), quota: vi.fn(), generate: vi.fn(), fetchMock: vi.fn(), runtime: vi.fn(),
}));
vi.mock('@/ai/routing/serverPersona', () => ({ resolveChatPersona: resolvePersona }));
vi.mock('@/ai/rateLimit/chatRateLimit', () => ({ checkChatRateLimit: quota }));
vi.mock('@/ai/providers/featureRuntime', () => ({ getRuntimeForFeature: runtime }));
vi.mock('@/ai/prompts/promptStore', () => ({ getPromptTemplate: vi.fn(async () => 'rules') }));
vi.mock('@/ai/logging/logFeatureUsage', () => ({ logFeatureUsage: vi.fn() }));
vi.mock('ai', () => ({ generateText: generate }));
import { POST } from '../../app/api/transcribe+api';

function audioRequest(mode: string) {
  const body = new FormData();
  body.append('audio', new Blob(['fake-audio'], { type: 'audio/webm' }), 'audio.webm');
  body.append('mode', mode);
  return new Request('https://app.test/api/transcribe', { method: 'POST', body });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('OPENAI_API_KEY', 'test-key');
  vi.stubGlobal('fetch', fetchMock);
  resolvePersona.mockResolvedValue({ verified: true, userId: 'user', persona: 'public' });
  quota.mockResolvedValue({ allowed: true });
  fetchMock.mockResolvedValue(new Response('bonjour'));
  runtime.mockResolvedValue({ model: 'test', modelId: 'test', options: {} });
  generate.mockResolvedValue({ text: 'test', usage: {} });
});

describe('transcription access and billing protection', () => {
  it('rejects anonymous/invalid tokens before parsing audio or calling providers', async () => {
    resolvePersona.mockResolvedValue({ verified: false, userId: null, persona: 'public' });
    const request = audioRequest('raw');
    expect((await POST(request)).status).toBe(401);
    expect(request.bodyUsed).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });
  it('refuses exhausted quotas without calling Whisper', async () => {
    quota.mockResolvedValue({ allowed: false });
    expect((await POST(audioRequest('raw'))).status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(['report', 'transcription'])('rejects public accounts in professional mode %s', async (mode) => {
    expect((await POST(audioRequest(mode))).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });
  it('keeps plain dictation available to authenticated public accounts', async () => {
    const res = await POST(audioRequest('raw'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ transcription: 'bonjour' });
    expect(quota).toHaveBeenCalledWith(expect.any(Request), 'public', { scope: 'audio' });
    expect(generate).not.toHaveBeenCalled();
  });
  it('allows the professional audio workflow with a server-derived identity', async () => {
    resolvePersona.mockResolvedValue({ verified: true, userId: 'pro', persona: 'professional' });
    expect((await POST(audioRequest('report'))).status).toBe(200);
    expect(generate).toHaveBeenCalledTimes(2);
  });
});
