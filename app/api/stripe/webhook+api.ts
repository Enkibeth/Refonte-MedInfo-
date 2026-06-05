/**
 * Route API webhook Stripe — POST /api/stripe/webhook (06_BILLING §6 — ADR-0012).
 *
 * SEULE source de vérité du statut payant. Signature vérifiée (STRIPE_WEBHOOK_SECRET), idempotent
 * (table billing_events), écriture via service_role (le client ne peut pas s'auto-promouvoir).
 * Aucune donnée de santé. Le corps BRUT est requis pour la vérification de signature.
 */
import { createClient } from '@supabase/supabase-js';

import { verifyStripeSignature } from '@/billing/stripeSignature';
import { handleStripeEvent, type StripeWebhookEvent } from '@/billing/webhookHandler';

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(request: Request): Promise<Response> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!webhookSecret || !url || !serviceKey) {
    return json({ error: 'Webhook non configuré.' }, 503);
  }

  const payload = await request.text();
  const signature = request.headers.get('stripe-signature');
  const verdict = verifyStripeSignature(payload, signature, webhookSecret);
  if (!verdict.valid) {
    return json({ error: 'Signature invalide.' }, 400);
  }

  let event: StripeWebhookEvent;
  try {
    event = JSON.parse(payload) as StripeWebhookEvent;
  } catch {
    return json({ error: 'Payload invalide.' }, 400);
  }
  if (!event?.id || !event?.type) return json({ error: 'Événement invalide.' }, 400);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  try {
    const outcome = await handleStripeEvent(event, {
      isProcessed: async (id) => {
        const { data } = await admin
          .from('billing_events')
          .select('stripe_event_id')
          .eq('stripe_event_id', id)
          .maybeSingle();
        return Boolean(data);
      },
      markProcessed: async (id, type) => {
        await admin.from('billing_events').insert({ stripe_event_id: id, type });
      },
      upsertSubscription: async (subscription) => {
        const { error } = await admin.from('subscriptions').upsert(
          {
            user_id: subscription.user_id,
            stripe_customer_id: subscription.stripe_customer_id,
            stripe_subscription_id: subscription.stripe_subscription_id,
            plan: subscription.plan,
            status: subscription.status,
            current_period_end: subscription.current_period_end,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        );
        if (error) throw new Error(error.message);
      },
    });

    // 200 même pour duplicate/ignored : on confirme la réception à Stripe (pas de retry inutile).
    return json({ received: true, outcome }, 200);
  } catch (error) {
    // 500 → Stripe réessaiera (le traitement est idempotent).
    return json({ error: error instanceof Error ? error.message : 'Erreur webhook.' }, 500);
  }
}
