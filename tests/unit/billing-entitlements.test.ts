import { describe, it, expect } from 'vitest';

import { resolveEntitlement } from '@/billing/entitlements';

/**
 * Droits d'usage (06_BILLING §1, §5). Pur, aucune donnée santé.
 * Invariant critique §5 : l'entitlement ne gate JAMAIS les sources.
 */
describe('resolveEntitlement', () => {
  it('aucun abonnement → free, quota standard (non illimité)', () => {
    expect(resolveEntitlement(null)).toEqual({ tier: 'free', unlimitedMessages: false });
    expect(resolveEntitlement(undefined)).toEqual({ tier: 'free', unlimitedMessages: false });
  });

  it('abonnement actif/trialing → payé, messages illimités', () => {
    for (const status of ['active', 'trialing']) {
      expect(resolveEntitlement({ plan: 'public_mid', status })).toEqual({
        tier: 'paid',
        unlimitedMessages: true,
      });
    }
  });

  it('statut non actif (canceled/past_due/incomplete/unpaid) → free', () => {
    for (const status of ['canceled', 'past_due', 'incomplete', 'incomplete_expired', 'unpaid']) {
      expect(resolveEntitlement({ plan: 'student_mid', status })).toEqual({
        tier: 'free',
        unlimitedMessages: false,
      });
    }
  });

  it('NE gate JAMAIS les sources : aucun champ de gating de sources dans l’entitlement (06_BILLING §5)', () => {
    const entitlement = resolveEntitlement({ plan: 'student_premium', status: 'active' });
    // L'entitlement ne porte QUE le volume de messages. Tout champ « source/citation/has/ansm »
    // serait une régression réglementaire interdite.
    expect(Object.keys(entitlement).sort()).toEqual(['tier', 'unlimitedMessages']);
    const forbidden = /source|citation|has|ansm|rag/i;
    expect(Object.keys(entitlement).some((k) => forbidden.test(k))).toBe(false);
  });
});
