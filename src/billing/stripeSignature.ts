/**
 * Vérification de signature des webhooks Stripe (06_BILLING §6, ADR-0012).
 *
 * Le webhook est la SEULE source de vérité du statut payant : sa signature DOIT être vérifiée
 * avant tout traitement. Implémentation maison en `node:crypto` (pas de SDK) → testable hors
 * réseau (gate de sécurité prouvé par tests/unit/stripe-signature.test.ts).
 *
 * Schéma Stripe : en-tête `Stripe-Signature: t=<ts>,v1=<hex>,...`. La signature attendue est
 * HMAC-SHA256(`${t}.${payload}`, secret) en hex. Comparaison en temps constant + fenêtre de
 * tolérance temporelle anti-rejeu.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface VerifyResult {
  valid: boolean;
  reason?:
    | 'missing_header'
    | 'missing_secret'
    | 'malformed_header'
    | 'malformed_timestamp'
    | 'timestamp_out_of_tolerance'
    | 'signature_mismatch';
}

export interface VerifyOptions {
  /** Fenêtre de tolérance en secondes (défaut Stripe : 300 s). */
  toleranceSec?: number;
  /** Horodatage courant en secondes (injectable pour les tests). */
  nowSec?: number;
}

export function verifyStripeSignature(
  payload: string,
  signatureHeader: string | null | undefined,
  secret: string,
  options: VerifyOptions = {},
): VerifyResult {
  if (!signatureHeader) return { valid: false, reason: 'missing_header' };
  if (!secret) return { valid: false, reason: 'missing_secret' };

  let timestamp: string | undefined;
  const candidates: string[] = [];
  for (const part of signatureHeader.split(',')) {
    const [key, value] = part.split('=');
    const k = key?.trim();
    const v = value?.trim();
    if (!k || !v) continue;
    if (k === 't') timestamp = v;
    else if (k === 'v1') candidates.push(v);
  }

  if (!timestamp || candidates.length === 0) return { valid: false, reason: 'malformed_header' };

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return { valid: false, reason: 'malformed_timestamp' };

  const tolerance = options.toleranceSec ?? 300;
  const now = options.nowSec ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > tolerance) return { valid: false, reason: 'timestamp_out_of_tolerance' };

  const expected = createHmac('sha256', secret).update(`${timestamp}.${payload}`, 'utf8').digest('hex');
  const expectedBuf = Buffer.from(expected, 'hex');

  const matched = candidates.some((candidate) => {
    const candidateBuf = Buffer.from(candidate, 'hex');
    if (candidateBuf.length !== expectedBuf.length) return false;
    return timingSafeEqual(candidateBuf, expectedBuf);
  });

  return matched ? { valid: true } : { valid: false, reason: 'signature_mismatch' };
}
