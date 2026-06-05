/**
 * Création d'une session Stripe Checkout (06_BILLING §3, §4 — ADR-0012).
 *
 * Appel direct à l'API REST Stripe via `fetch` (pas de SDK) → testable hors réseau en injectant
 * `fetchImpl` (tests/unit/billing-checkout.test.ts). Mode `subscription`, web-first.
 *
 * Les `metadata` user_id/plan sont propagées sur l'abonnement (`subscription_data[metadata]`)
 * afin que le webhook (source de vérité) puisse rattacher l'abonnement au bon compte et plan.
 * Aucune donnée de santé n'est transmise.
 */
import type { BillingPlanId } from '@/billing/plans';

export interface CheckoutParams {
  plan: BillingPlanId;
  userId: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutDeps {
  secretKey: string;
  priceId: string;
  fetchImpl?: typeof fetch;
}

export interface CheckoutSessionResult {
  id: string;
  url: string;
}

const STRIPE_CHECKOUT_URL = 'https://api.stripe.com/v1/checkout/sessions';

export async function createCheckoutSession(
  params: CheckoutParams,
  deps: CheckoutDeps,
): Promise<CheckoutSessionResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;

  const form = new URLSearchParams();
  form.set('mode', 'subscription');
  form.set('line_items[0][price]', deps.priceId);
  form.set('line_items[0][quantity]', '1');
  form.set('success_url', params.successUrl);
  form.set('cancel_url', params.cancelUrl);
  form.set('client_reference_id', params.userId);
  if (params.customerEmail) form.set('customer_email', params.customerEmail);
  form.set('metadata[user_id]', params.userId);
  form.set('metadata[plan]', params.plan);
  form.set('subscription_data[metadata][user_id]', params.userId);
  form.set('subscription_data[metadata][plan]', params.plan);

  const response = await fetchImpl(STRIPE_CHECKOUT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${deps.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Stripe checkout a échoué (${response.status})${detail ? `: ${detail}` : ''}`);
  }

  const data = (await response.json()) as { id?: string; url?: string };
  if (!data.id || !data.url) {
    throw new Error('Stripe checkout : réponse inattendue (id/url manquant).');
  }

  return { id: data.id, url: data.url };
}
