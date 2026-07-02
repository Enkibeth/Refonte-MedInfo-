import { describe, expect, it } from 'vitest';

import { formatResetTime, parseChatApiError } from '@/chat/apiError';

describe('parseChatApiError', () => {
  it('détecte le quota atteint (429) et extrait reset_at', () => {
    const body = JSON.stringify({
      error: 'rate_limited',
      message: 'Quota quotidien de messages atteint.',
      daily_limit: 10,
      remaining: 0,
      reset_at: '2026-07-03T00:00:00.000Z',
    });
    expect(parseChatApiError(body)).toEqual({
      kind: 'rate_limited',
      resetAt: '2026-07-03T00:00:00.000Z',
    });
  });

  it('détecte le verrou invité (401 signup_required)', () => {
    expect(parseChatApiError('{"error":"signup_required","message":"Créez un compte"}')).toEqual({
      kind: 'signup_required',
    });
  });

  it('tolère un préfixe non-JSON devant le corps', () => {
    const parsed = parseChatApiError('Error: {"error":"rate_limited","reset_at":"2026-07-03T00:00:00Z"}');
    expect(parsed.kind).toBe('rate_limited');
  });

  it('retombe sur generic pour tout le reste', () => {
    expect(parseChatApiError('Failed to fetch').kind).toBe('generic');
    expect(parseChatApiError('').kind).toBe('generic');
    expect(parseChatApiError(undefined).kind).toBe('generic');
  });
});

describe('formatResetTime', () => {
  it('formate en HH:MM et rejette les dates invalides', () => {
    expect(formatResetTime('2026-07-03T00:00:00.000Z')).toMatch(/^\d{2}:\d{2}$/);
    expect(formatResetTime('pas-une-date')).toBeNull();
    expect(formatResetTime(null)).toBeNull();
  });
});
