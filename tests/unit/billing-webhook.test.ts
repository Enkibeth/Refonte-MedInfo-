import { describe, it, expect, beforeEach } from 'vitest';

import {
  handleStripeEvent,
  type StripeWebhookEvent,
  type SubscriptionUpsert,
  type WebhookDeps,
} from '@/billing/webhookHandler';

/**
 * Traitement des événements webhook Stripe (06_BILLING §6). Idempotent, mapping des statuts,
 * aucune donnée santé. Deps en mémoire (hors réseau).
 */
function makeDeps() {
  const processed = new Set<string>();
  const upserts: SubscriptionUpsert[] = [];
  const deps: WebhookDeps = {
    isProcessed: async (id) => processed.has(id),
    markProcessed: async (id) => {
      processed.add(id);
    },
    upsertSubscription: async (sub) => {
      upserts.push(sub);
    },
  };
  return { deps, processed, upserts };
}

function checkoutCompleted(id = 'evt_checkout'): StripeWebhookEvent {
  return {
    id,
    type: 'checkout.session.completed',
    data: {
      object: {
        customer: 'cus_123',
        subscription: 'sub_123',
        metadata: { user_id: 'user-A', plan: 'public_mid' },
      },
    },
  };
}

describe('handleStripeEvent', () => {
  let ctx: ReturnType<typeof makeDeps>;
  beforeEach(() => {
    ctx = makeDeps();
  });

  it('checkout.session.completed → upsert actif rattaché au bon user/plan', async () => {
    const outcome = await handleStripeEvent(checkoutCompleted(), ctx.deps);
    expect(outcome).toEqual({ handled: true, action: 'upserted', status: 'active' });
    expect(ctx.upserts).toHaveLength(1);
    expect(ctx.upserts[0]).toMatchObject({
      user_id: 'user-A',
      stripe_customer_id: 'cus_123',
      stripe_subscription_id: 'sub_123',
      plan: 'public_mid',
      status: 'active',
    });
  });

  it('est idempotent : un même event.id ne ré-upsert pas', async () => {
    await handleStripeEvent(checkoutCompleted('evt_dup'), ctx.deps);
    const second = await handleStripeEvent(checkoutCompleted('evt_dup'), ctx.deps);
    expect(second).toEqual({ handled: false, reason: 'duplicate' });
    expect(ctx.upserts).toHaveLength(1);
  });

  it('customer.subscription.deleted → statut canceled', async () => {
    const event: StripeWebhookEvent = {
      id: 'evt_del',
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_123',
          customer: 'cus_123',
          status: 'canceled',
          metadata: { user_id: 'user-A', plan: 'public_mid' },
        },
      },
    };
    const outcome = await handleStripeEvent(event, ctx.deps);
    expect(outcome).toEqual({ handled: true, action: 'upserted', status: 'canceled' });
    expect(ctx.upserts[0].status).toBe('canceled');
  });

  it('customer.subscription.updated → reflète le statut Stripe + période', async () => {
    const periodEnd = 1_730_000_000;
    const event: StripeWebhookEvent = {
      id: 'evt_upd',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_123',
          customer: 'cus_123',
          status: 'past_due',
          current_period_end: periodEnd,
          metadata: { user_id: 'user-A', plan: 'student_mid' },
        },
      },
    };
    const outcome = await handleStripeEvent(event, ctx.deps);
    expect(outcome).toMatchObject({ handled: true, status: 'past_due' });
    expect(ctx.upserts[0].current_period_end).toBe(new Date(periodEnd * 1000).toISOString());
  });

  it('événement hors périmètre → ignoré, aucun upsert', async () => {
    const event: StripeWebhookEvent = {
      id: 'evt_other',
      type: 'invoice.paid',
      data: { object: {} },
    };
    const outcome = await handleStripeEvent(event, ctx.deps);
    expect(outcome).toEqual({ handled: false, reason: 'ignored_event' });
    expect(ctx.upserts).toHaveLength(0);
  });

  it('payload incomplet (plan absent/inconnu) → invalid_payload, non marqué traité', async () => {
    const event: StripeWebhookEvent = {
      id: 'evt_bad',
      type: 'checkout.session.completed',
      data: { object: { customer: 'cus_123', metadata: { user_id: 'user-A', plan: 'pro_mid' } } },
    };
    const outcome = await handleStripeEvent(event, ctx.deps);
    expect(outcome).toEqual({ handled: false, reason: 'invalid_payload' });
    expect(ctx.upserts).toHaveLength(0);
    expect(ctx.processed.has('evt_bad')).toBe(false);
  });
});
