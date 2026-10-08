import { afterEach, describe, expect, it, vi } from 'vitest';
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient }));

import {
  __resetChatRateLimitForTests,
  checkChatRateLimit,
  checkGuestChatQuota,
  GUEST_CHAT_DAILY_LIMIT,
} from '@/ai/rateLimit/chatRateLimit';

function requestFromIp(ip: string): Request {
  return new Request('https://medinfo.test/api/chat', {
    method: 'POST',
    headers: { 'x-forwarded-for': ip },
  });
}

afterEach(() => {
  __resetChatRateLimitForTests();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('chat rate-limit — free MVP', () => {
  it('fails closed in production when no persistent quota backend is configured', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    expect((await checkChatRateLimit(requestFromIp('203.0.113.10'), 'public')).allowed).toBe(false);
    expect((await checkGuestChatQuota(requestFromIp('203.0.113.10'))).allowed).toBe(false);
  });
  it('paid professional accounts are still counted with the anti-abuse ceiling', async () => {
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'server-test-key');
    const rpc = vi.fn(async () => ({ data: [{ allowed: true, daily_count: 1, daily_limit: 500, remaining: 499, reset_at: 'tomorrow' }], error: null }));
    const db = {
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'account' } }, error: null })) },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { status: 'active', plan: 'student' } }) }) }) }),
      rpc,
    };
    createClient.mockReturnValue(db);
    const result = await checkChatRateLimit(new Request('https://app.test', { headers: { authorization: 'Bearer test' } }), 'professional', { scope: 'chat' });
    expect(createClient).toHaveBeenCalledWith('https://test.supabase.co', 'server-test-key', expect.anything());
    expect(rpc).toHaveBeenCalledWith('increment_usage_counter', expect.objectContaining({ p_daily_limit: 500, p_counter_key: 'chat:user:account' }));
    expect(result.dailyCount).toBe(1);
  });
  it('a rejected RPC promise denies the request rather than enabling a memory fallback', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'server-test-key');
    createClient.mockReturnValue({ rpc: vi.fn(async () => { throw new Error('offline'); }) });
    expect((await checkGuestChatQuota(requestFromIp('203.0.113.10'))).allowed).toBe(false);
  });
  it('public free : le 11e message du même jour renvoie limited (429 côté handler)', async () => {
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');

    for (let i = 1; i <= 10; i += 1) {
      const result = await checkChatRateLimit(requestFromIp('203.0.113.10'), 'public');
      expect(result.allowed).toBe(true);
      expect(result.dailyLimit).toBe(10);
    }

    const eleventh = await checkChatRateLimit(requestFromIp('203.0.113.10'), 'public');
    expect(eleventh.allowed).toBe(false);
    expect(eleventh.status).toBe('limited');
    expect(eleventh.dailyCount).toBe(11);
    expect(eleventh.remaining).toBe(0);
  });

  it('student free : le 21e message du même jour est limité', async () => {
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');

    for (let i = 1; i <= 20; i += 1) {
      const result = await checkChatRateLimit(requestFromIp('203.0.113.20'), 'student');
      expect(result.allowed).toBe(true);
      expect(result.dailyLimit).toBe(20);
    }

    const twentyFirst = await checkChatRateLimit(requestFromIp('203.0.113.20'), 'student');
    expect(twentyFirst.allowed).toBe(false);
    expect(twentyFirst.status).toBe('limited');
    expect(twentyFirst.dailyCount).toBe(21);
  });

  it('le cap dur IP non-authentifié isole deux IP différentes', async () => {
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');

    for (let i = 1; i <= 10; i += 1) {
      await checkChatRateLimit(requestFromIp('203.0.113.30'), 'public');
    }

    const limitedIp = await checkChatRateLimit(requestFromIp('203.0.113.30'), 'public');
    const otherIp = await checkChatRateLimit(requestFromIp('203.0.113.31'), 'public');

    expect(limitedIp.allowed).toBe(false);
    expect(otherIp.allowed).toBe(true);
    expect(otherIp.dailyCount).toBe(1);
  });
});

describe('essai sans inscription du chat — plafond par IP', () => {
  it(`la ${GUEST_CHAT_DAILY_LIMIT + 1}e conversation anonyme du jour depuis la même IP est refusée`, async () => {
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');

    for (let i = 1; i <= GUEST_CHAT_DAILY_LIMIT; i += 1) {
      expect((await checkGuestChatQuota(requestFromIp('198.51.100.7'))).allowed).toBe(true);
    }
    const over = await checkGuestChatQuota(requestFromIp('198.51.100.7'));
    expect(over.allowed).toBe(false);
    expect(over.identityType).toBe('ip');

    expect((await checkGuestChatQuota(requestFromIp('198.51.100.8'))).allowed).toBe(true);
  });

  it("n'entame pas le quota de l'analyse de document (compteurs distincts)", async () => {
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');

    for (let i = 1; i <= GUEST_CHAT_DAILY_LIMIT + 1; i += 1) {
      await checkGuestChatQuota(requestFromIp('198.51.100.9'));
    }
    const analyze = await checkChatRateLimit(requestFromIp('198.51.100.9'), 'public');
    expect(analyze.allowed).toBe(true);
    expect(analyze.dailyCount).toBe(1);
  });
});
