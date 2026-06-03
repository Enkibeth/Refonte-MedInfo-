import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  __resetChatRateLimitForTests,
  checkChatRateLimit,
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
});

describe('chat rate-limit — free MVP', () => {
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
