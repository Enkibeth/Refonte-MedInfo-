import { describe, it, expect, vi } from 'vitest';

/**
 * ADR-0010 : smoke test de l'AuthProvider (password + OAuth). On mocke le client Supabase
 * et expo-linking (aucun réseau, aucune donnée santé) et on vérifie que le module se charge
 * et expose son contrat public.
 */
vi.mock('@/db/supabase', () => ({
  getSupabaseClient: () => ({
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithPassword: vi.fn(async () => ({ error: null })),
      signUp: vi.fn(async () => ({
        data: { session: null, user: { identities: [{ id: '1' }] } },
        error: null,
      })),
      signInWithOAuth: vi.fn(async () => ({ error: null })),
      resend: vi.fn(async () => ({ error: null })),
      resetPasswordForEmail: vi.fn(async () => ({ error: null })),
      signInWithOtp: vi.fn(async () => ({ error: null })),
      signOut: vi.fn(async () => ({ error: null })),
    },
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: { persona: 'public' } }) }) }),
    }),
  }),
}));

vi.mock('expo-linking', () => ({ createURL: (p: string) => `https://app.test${p}` }));

describe('AuthProvider — ADR-0010 (password + OAuth)', () => {
  it('se charge et expose AuthProvider + useSession', async () => {
    const mod = await import('@/auth/AuthProvider');
    expect(typeof mod.AuthProvider).toBe('function');
    expect(typeof mod.useSession).toBe('function');
  });

  it('useSession lève hors provider (garde-fou)', async () => {
    const { useSession } = await import('@/auth/AuthProvider');
    expect(() => useSession()).toThrow();
  });

  it('priorise EXPO_PUBLIC_AUTH_REDIRECT_URL pour les liens email/OAuth', async () => {
    vi.stubEnv('EXPO_PUBLIC_AUTH_REDIRECT_URL', 'https://app.medinfo.test/auth/callback');
    const { getAuthRedirectTo } = await import('@/auth/AuthProvider');
    expect(getAuthRedirectTo()).toBe('https://app.medinfo.test/auth/callback');
    vi.unstubAllEnvs();
  });
});
