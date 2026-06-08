import { afterEach, describe, expect, it, vi } from 'vitest';

import { __resetChatRateLimitForTests } from '@/ai/rateLimit/chatRateLimit';
import { runClassifierGate } from '@/ai/classifier/gate';

vi.mock('@/ai/classifier/gate', () => ({
  runClassifierGate: vi.fn(async () => ({ action: 'block', category: 'ambiguous' })),
}));

vi.mock('@/ai/logging/logInteraction', () => ({
  logInteraction: vi.fn(async () => undefined),
}));

function chatRequest(ip: string): Request {
  return new Request('https://medinfo.test/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify({
      persona: 'public',
      messages: [{ role: 'user', content: 'Donne une information générale sur les vaccins.' }],
    }),
  });
}

afterEach(() => {
  __resetChatRateLimitForTests();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('POST /api/chat — rate-limit avant couche 1', () => {
  it('public free : le 11e message du même jour renvoie 429 sans appeler le classifieur', async () => {
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    // Ce test porte sur l'interaction rate-limit + couche 1 ; la safe-box étant neutralisée
    // par défaut (ADR-0023), on la force à « on » pour exercer le court-circuit classifieur.
    vi.stubEnv('MEDINFO_GUARDRAILS', 'on');

    const { POST } = await import('../../app/api/chat+api');

    for (let i = 1; i <= 10; i += 1) {
      const response = await POST(chatRequest('198.51.100.10'));
      expect(response.status).toBe(200);
    }

    expect(runClassifierGate).toHaveBeenCalledTimes(10);

    const eleventh = await POST(chatRequest('198.51.100.10'));
    const payload = await eleventh.json();

    expect(eleventh.status).toBe(429);
    expect(payload.daily_limit).toBe(10);
    expect(payload.remaining).toBe(0);
    expect(runClassifierGate).toHaveBeenCalledTimes(10);
  });
});
