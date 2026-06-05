import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';

import { verifyStripeSignature } from '@/billing/stripeSignature';

/**
 * Vérification de signature webhook Stripe (06_BILLING §6). Gate de sécurité : le webhook est la
 * seule source de vérité du statut payant → la signature doit être réellement vérifiée.
 */
const SECRET = 'whsec_test_secret';

function sign(payload: string, ts: number, secret = SECRET): string {
  const v1 = createHmac('sha256', secret).update(`${ts}.${payload}`, 'utf8').digest('hex');
  return `t=${ts},v1=${v1}`;
}

describe('verifyStripeSignature', () => {
  const payload = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' });
  const now = 1_700_000_000;

  it('accepte une signature valide dans la fenêtre de tolérance', () => {
    const header = sign(payload, now);
    expect(verifyStripeSignature(payload, header, SECRET, { nowSec: now })).toEqual({ valid: true });
  });

  it('rejette un payload altéré (signature ne correspond plus)', () => {
    const header = sign(payload, now);
    const tampered = payload.replace('checkout.session.completed', 'customer.subscription.deleted');
    expect(verifyStripeSignature(tampered, header, SECRET, { nowSec: now })).toMatchObject({
      valid: false,
      reason: 'signature_mismatch',
    });
  });

  it('rejette un mauvais secret', () => {
    const header = sign(payload, now, 'whsec_wrong');
    expect(verifyStripeSignature(payload, header, SECRET, { nowSec: now })).toMatchObject({
      valid: false,
      reason: 'signature_mismatch',
    });
  });

  it('rejette un timestamp hors tolérance (anti-rejeu)', () => {
    const header = sign(payload, now - 10_000);
    expect(verifyStripeSignature(payload, header, SECRET, { nowSec: now, toleranceSec: 300 })).toMatchObject({
      valid: false,
      reason: 'timestamp_out_of_tolerance',
    });
  });

  it('rejette un en-tête manquant ou malformé', () => {
    expect(verifyStripeSignature(payload, null, SECRET)).toMatchObject({ valid: false, reason: 'missing_header' });
    expect(verifyStripeSignature(payload, 'garbage', SECRET, { nowSec: now })).toMatchObject({
      valid: false,
      reason: 'malformed_header',
    });
  });

  it('rejette un secret vide', () => {
    expect(verifyStripeSignature(payload, sign(payload, now), '')).toMatchObject({
      valid: false,
      reason: 'missing_secret',
    });
  });
});
