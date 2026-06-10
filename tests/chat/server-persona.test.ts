import { describe, expect, it } from 'vitest';

import { resolveChatPersona } from '@/ai/routing/serverPersona';

/**
 * CC-01 / INV-A : la persona effective est dérivée du PROFIL VÉRIFIÉ, jamais du body.
 * Un client anonyme ou public ne peut pas s'auto-élever en `student`.
 */

type FakeProfile = { persona?: string } | null;

/** Faux client Supabase : auth.getUser + lecture profiles.persona, sans réseau. */
function fakeSupabase(opts: { userId: string | null; profile?: FakeProfile }) {
  return {
    auth: {
      getUser: async (_token: string) =>
        opts.userId
          ? { data: { user: { id: opts.userId } }, error: null }
          : { data: { user: null }, error: { message: 'invalid token' } },
    },
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, _val: string) => ({
          maybeSingle: async () => ({ data: opts.profile ?? null, error: null }),
        }),
      }),
    }),
  } as any;
}

function request(token?: string): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request('https://medinfo.test/api/chat', { method: 'POST', headers });
}

describe('resolveChatPersona — persona dérivée du serveur (CC-01)', () => {
  it('anonyme + body "student" → public (élévation refusée)', async () => {
    const res = await resolveChatPersona(request(), 'student', { supabase: fakeSupabase({ userId: null }) });

    expect(res.persona).toBe('public');
    expect(res.verified).toBe(false);
    expect(res.attemptedElevation).toBe(true);
  });

  it('token valide, profil public, body "student" → public (élévation refusée)', async () => {
    const res = await resolveChatPersona(request('tok'), 'student', {
      supabase: fakeSupabase({ userId: 'u1', profile: { persona: 'public' } }),
    });

    expect(res.persona).toBe('public');
    expect(res.verified).toBe(true);
    expect(res.attemptedElevation).toBe(true);
  });

  it('token valide, profil student, body "student" → student (autorisé, pas d’élévation)', async () => {
    const res = await resolveChatPersona(request('tok'), 'student', {
      supabase: fakeSupabase({ userId: 'u2', profile: { persona: 'student' } }),
    });

    expect(res.persona).toBe('student');
    expect(res.verified).toBe(true);
    expect(res.attemptedElevation).toBe(false);
  });

  it('token valide, profil student, body "public" → student (profil prime sur le body)', async () => {
    const res = await resolveChatPersona(request('tok'), 'public', {
      supabase: fakeSupabase({ userId: 'u2', profile: { persona: 'student' } }),
    });

    expect(res.persona).toBe('student');
    expect(res.attemptedElevation).toBe(false);
  });

  it('token valide, profil professional → professional (les 3 chatbots sont ouverts, refonte 2026-06)', async () => {
    const res = await resolveChatPersona(request('tok'), 'student', {
      supabase: fakeSupabase({ userId: 'u3', profile: { persona: 'professional' } }),
    });

    expect(res.persona).toBe('professional');
    expect(res.attemptedElevation).toBe(false);
  });

  it('token invalide → public (jamais d’identité non vérifiée)', async () => {
    const res = await resolveChatPersona(request('bad'), 'student', {
      supabase: fakeSupabase({ userId: null, profile: { persona: 'student' } }),
    });

    expect(res.persona).toBe('public');
    expect(res.verified).toBe(false);
  });

  it('profil absent (nouvel utilisateur) → public fail-safe', async () => {
    const res = await resolveChatPersona(request('tok'), 'student', {
      supabase: fakeSupabase({ userId: 'u4', profile: null }),
    });

    expect(res.persona).toBe('public');
  });

  it('Supabase non configuré → public', async () => {
    const res = await resolveChatPersona(request('tok'), 'student', { supabase: null });

    expect(res.persona).toBe('public');
    expect(res.verified).toBe(false);
  });
});
