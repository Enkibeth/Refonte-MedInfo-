import { describe, it, expect } from 'vitest';

import { createCheckoutSession } from '@/billing/createCheckoutSession';
import { BILLING_PLANS, isBillingPlanId, plansForPersona } from '@/billing/plans';

/**
 * Création de session Checkout (06_BILLING §3, §4) + garde-fous du catalogue de plans.
 * `fetch` injecté → aucun appel réseau réel.
 */
describe('catalogue de plans (06_BILLING §1)', () => {
  it('valide uniquement les plans MVP public/étudiant', () => {
    expect(isBillingPlanId('public_mid')).toBe(true);
    expect(isBillingPlanId('student_mid')).toBe(true);
    expect(isBillingPlanId('student_premium')).toBe(true);
  });

  it('REJETTE tout plan professionnel (gelé ADR-0006)', () => {
    expect(isBillingPlanId('pro_mid')).toBe(false);
    expect(isBillingPlanId('pro_premium')).toBe(false);
    expect(Object.values(BILLING_PLANS).some((p) => (p.persona as string) === 'professional')).toBe(false);
  });

  it('filtre les offres par persona (audience gating)', () => {
    expect(plansForPersona('public').map((p) => p.id)).toEqual(['public_mid']);
    expect(plansForPersona('student').map((p) => p.id)).toEqual(['student_mid', 'student_premium']);
    expect(plansForPersona('professional')).toEqual([]);
  });
});

describe('createCheckoutSession', () => {
  it('construit une session abonnement avec metadata user_id/plan propagées', async () => {
    let captured: { url: string; init: RequestInit } | null = null;
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      captured = { url: String(url), init: init ?? {} };
      return new Response(JSON.stringify({ id: 'cs_test', url: 'https://checkout.stripe.com/c/pay/cs_test' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    const result = await createCheckoutSession(
      {
        plan: 'student_mid',
        userId: 'user-A',
        customerEmail: 'a@medinfo.test',
        successUrl: 'https://app.test/account?billing=success',
        cancelUrl: 'https://app.test/pricing?billing=cancel',
      },
      { secretKey: 'sk_test', priceId: 'price_123', fetchImpl },
    );

    expect(result).toEqual({ id: 'cs_test', url: 'https://checkout.stripe.com/c/pay/cs_test' });
    expect(captured!.url).toBe('https://api.stripe.com/v1/checkout/sessions');
    const body = String(captured!.init.body);
    expect(body).toContain('mode=subscription');
    expect(body).toContain('line_items%5B0%5D%5Bprice%5D=price_123');
    expect(body).toContain('metadata%5Buser_id%5D=user-A');
    expect(body).toContain('metadata%5Bplan%5D=student_mid');
    expect(body).toContain('subscription_data%5Bmetadata%5D%5Buser_id%5D=user-A');
    const auth = (captured!.init.headers as Record<string, string>).Authorization;
    expect(auth).toBe('Bearer sk_test');
  });

  it('lève une erreur si Stripe répond non-2xx', async () => {
    const fetchImpl = (async () =>
      new Response('{"error":{"message":"bad"}}', { status: 400 })) as unknown as typeof fetch;

    await expect(
      createCheckoutSession(
        {
          plan: 'public_mid',
          userId: 'user-A',
          customerEmail: '',
          successUrl: 'https://app.test/ok',
          cancelUrl: 'https://app.test/ko',
        },
        { secretKey: 'sk_test', priceId: 'price_123', fetchImpl },
      ),
    ).rejects.toThrow(/Stripe checkout a échoué \(400\)/);
  });
});
