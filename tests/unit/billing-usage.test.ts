/**
 * Quotas d'usage PAR FEATURE (06_BILLING §1, ADR-0012).
 *
 * Tests purs (sans Supabase) sur le repli mémoire de checkAndConsume :
 *   - quota mensuel atteint → refus propre (allowed=false → 429 côté route) ;
 *   - reset de période : un nouveau mois repart à zéro ;
 *   - isolation entre users / entre features ;
 *   - barème de quotas par (plan, feature).
 *
 * L'isolation RLS (cross-user en base) est prouvée dans tests/rls/usage-isolation.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __resetFeatureUsageForTests,
  checkAndConsume,
  enforceFeatureQuota,
  getFeatureQuota,
  FEATURE_QUOTAS,
} from '@/billing/usage';

const USER_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

beforeEach(() => {
  // Pas de Supabase → repli mémoire, barème 'free'.
  vi.stubEnv('SUPABASE_URL', '');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
});

afterEach(() => {
  __resetFeatureUsageForTests();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('barème FEATURE_QUOTAS', () => {
  it('quotas gratuits par défaut documentés (analyses/ECOS/audio)', () => {
    expect(getFeatureQuota('free', 'analyze')).toBe(10);
    expect(getFeatureQuota('free', 'ecos')).toBe(10);
    expect(getFeatureQuota('free', 'audio')).toBe(30);
    expect(getFeatureQuota('free', 'chat')).toBe(300);
  });

  it('les plans payants lèvent les plafonds de volume (Infinity)', () => {
    expect(getFeatureQuota('student_premium', 'analyze')).toBe(Infinity);
    expect(getFeatureQuota('student_mid', 'ecos')).toBe(Infinity);
    // public_mid n'a pas l'ECOS (feature étudiante) → quota 0.
    expect(getFeatureQuota('public_mid', 'ecos')).toBe(0);
  });

  it('chaque plan déclare bien les 4 features', () => {
    for (const plan of Object.keys(FEATURE_QUOTAS) as Array<keyof typeof FEATURE_QUOTAS>) {
      expect(Object.keys(FEATURE_QUOTAS[plan]).sort()).toEqual(['analyze', 'audio', 'chat', 'ecos']);
    }
  });
});

describe('checkAndConsume — quota mensuel atteint', () => {
  it('free analyze : la 11e analyse du mois est refusée (allowed=false, sans sur-consommation)', async () => {
    for (let i = 1; i <= 10; i += 1) {
      const r = await checkAndConsume(USER_A, 'analyze');
      expect(r.allowed).toBe(true);
      expect(r.consumed).toBe(i);
      expect(r.quota).toBe(10);
      expect(r.remaining).toBe(10 - i);
    }

    const eleventh = await checkAndConsume(USER_A, 'analyze');
    expect(eleventh.allowed).toBe(false);
    expect(eleventh.consumed).toBe(10); // pas de consommation au-delà du plafond
    expect(eleventh.remaining).toBe(0);
  });

  it('audio en MINUTES : un amount > quota restant est refusé sans rien consommer', async () => {
    const first = await checkAndConsume(USER_A, 'audio', 25); // 25/30 min
    expect(first.allowed).toBe(true);
    expect(first.consumed).toBe(25);

    const tooLong = await checkAndConsume(USER_A, 'audio', 10); // dépasserait 30
    expect(tooLong.allowed).toBe(false);
    expect(tooLong.consumed).toBe(25); // inchangé

    const fits = await checkAndConsume(USER_A, 'audio', 5); // pile 30
    expect(fits.allowed).toBe(true);
    expect(fits.consumed).toBe(30);
    expect(fits.remaining).toBe(0);
  });
});

describe('checkAndConsume — reset de période', () => {
  it('un nouveau mois repart de zéro', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-31T12:00:00.000Z'));

    for (let i = 1; i <= 10; i += 1) {
      await checkAndConsume(USER_A, 'analyze');
    }
    const capped = await checkAndConsume(USER_A, 'analyze');
    expect(capped.allowed).toBe(false);

    // Passage au mois suivant → compteur réinitialisé (nouvelle ligne de période).
    vi.setSystemTime(new Date('2026-02-01T00:00:00.000Z'));
    const fresh = await checkAndConsume(USER_A, 'analyze');
    expect(fresh.allowed).toBe(true);
    expect(fresh.consumed).toBe(1);
    expect(fresh.resetAt).toBe('2026-03-01T00:00:00.000Z');
  });
});

describe('checkAndConsume — isolation', () => {
  it('deux users consomment des compteurs indépendants', async () => {
    for (let i = 1; i <= 10; i += 1) await checkAndConsume(USER_A, 'analyze');

    const aCapped = await checkAndConsume(USER_A, 'analyze');
    const bFresh = await checkAndConsume(USER_B, 'analyze');

    expect(aCapped.allowed).toBe(false);
    expect(bFresh.allowed).toBe(true);
    expect(bFresh.consumed).toBe(1);
  });

  it('deux features du même user sont indépendantes', async () => {
    for (let i = 1; i <= 10; i += 1) await checkAndConsume(USER_A, 'analyze');

    const analyzeCapped = await checkAndConsume(USER_A, 'analyze');
    const ecosFresh = await checkAndConsume(USER_A, 'ecos');

    expect(analyzeCapped.allowed).toBe(false);
    expect(ecosFresh.allowed).toBe(true);
  });
});

describe('enforceFeatureQuota — anonymes non décomptés', () => {
  it('sans Bearer token → skipped=true, allowed=true (comportement gratuit IP inchangé)', async () => {
    const request = new Request('https://medinfo.test/api/analyze', { method: 'POST' });
    const r = await enforceFeatureQuota(request, 'analyze');
    expect(r.allowed).toBe(true);
    expect(r.skipped).toBe(true);
  });
});
