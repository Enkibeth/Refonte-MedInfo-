/**
 * Traitement (pur, injectable) des événements webhook Stripe (06_BILLING §6, ADR-0012).
 *
 * Source de vérité du statut payant. Idempotent : un même `event.id` n'upsert qu'une fois
 * (déduplication via `billing_events`). Aucune donnée de santé : on ne lit que user_id (metadata),
 * id client/abonnement Stripe, plan et statut.
 *
 * La logique est séparée des effets DB (deps injectées) → testée hors réseau
 * (tests/unit/billing-webhook.test.ts).
 */
import { isBillingPlanId, type BillingPlanId } from '@/billing/plans';

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

export interface SubscriptionUpsert {
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string | null;
  plan: BillingPlanId;
  status: string;
  current_period_end: string | null;
}

export interface WebhookDeps {
  isProcessed: (eventId: string) => Promise<boolean>;
  markProcessed: (eventId: string, type: string) => Promise<void>;
  upsertSubscription: (subscription: SubscriptionUpsert) => Promise<void>;
}

export type WebhookOutcome =
  | { handled: true; action: 'upserted'; status: string }
  | { handled: false; reason: 'duplicate' | 'ignored_event' | 'invalid_payload' };

const SUBSCRIPTION_EVENTS = new Set([
  'customer.subscription.updated',
  'customer.subscription.deleted',
]);

function asString(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string') {
    return (value as { id: string }).id;
  }
  return null;
}

function metadata(obj: Record<string, unknown>): Record<string, unknown> {
  const meta = obj.metadata;
  return meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : {};
}

function buildUpsert(event: StripeWebhookEvent): SubscriptionUpsert | null {
  const obj = event.data?.object ?? {};
  const meta = metadata(obj);
  const userId = typeof meta.user_id === 'string' ? meta.user_id : null;
  const plan = meta.plan;
  const customer = asString(obj.customer);

  if (!userId || !customer || !isBillingPlanId(plan)) return null;

  if (event.type === 'checkout.session.completed') {
    return {
      user_id: userId,
      stripe_customer_id: customer,
      stripe_subscription_id: asString(obj.subscription),
      plan,
      // Le checkout abonnement est complété → actif. La période exacte arrivera via
      // customer.subscription.updated (source de vérité continue).
      status: 'active',
      current_period_end: null,
    };
  }

  // customer.subscription.updated | deleted : l'objet EST l'abonnement.
  const status = event.type === 'customer.subscription.deleted'
    ? 'canceled'
    : (typeof obj.status === 'string' ? obj.status : 'active');
  const periodEnd = typeof obj.current_period_end === 'number'
    ? new Date(obj.current_period_end * 1000).toISOString()
    : null;

  return {
    user_id: userId,
    stripe_customer_id: customer,
    stripe_subscription_id: asString(obj.id),
    plan,
    status,
    current_period_end: periodEnd,
  };
}

export async function handleStripeEvent(
  event: StripeWebhookEvent,
  deps: WebhookDeps,
): Promise<WebhookOutcome> {
  if (await deps.isProcessed(event.id)) {
    return { handled: false, reason: 'duplicate' };
  }

  const isKnown = event.type === 'checkout.session.completed' || SUBSCRIPTION_EVENTS.has(event.type);
  if (!isKnown) {
    // Événement hors périmètre : on le marque traité pour éviter tout retraitement bruyant.
    await deps.markProcessed(event.id, event.type);
    return { handled: false, reason: 'ignored_event' };
  }

  const upsert = buildUpsert(event);
  if (!upsert) {
    // Payload incomplet : NON marqué traité → Stripe pourra réémettre après correction.
    return { handled: false, reason: 'invalid_payload' };
  }

  await deps.upsertSubscription(upsert);
  await deps.markProcessed(event.id, event.type);
  return { handled: true, action: 'upserted', status: upsert.status };
}
