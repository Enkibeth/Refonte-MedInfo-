/**
 * Route API Checkout — POST /api/billing/checkout (06_BILLING §3, §4 — ADR-0012).
 *
 * Crée une session Stripe Checkout (abonnement) pour l'utilisateur authentifié. L'identité est
 * dérivée du TOKEN (jamais du body) — modèle /api/role. Audience gating : le plan doit
 * correspondre à la persona vérifiée. Aucune donnée de santé. Ne gate JAMAIS les sources.
 *
 * Le statut payant n'est PAS écrit ici : seule la confirmation par webhook signé fait foi.
 */
import { createClient } from '@supabase/supabase-js';

import { BILLING_PLANS, isBillingPlanId } from '@/billing/plans';
import { createCheckoutSession } from '@/billing/createCheckoutSession';

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(request: Request): Promise<Response> {
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (!url || !serviceKey || !anonKey || !stripeSecret) {
    return json({ error: 'Facturation non configurée.' }, 503);
  }

  const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ error: 'Non authentifié.' }, 401);

  let body: { plan?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON invalide.' }, 400);
  }

  const plan = body.plan;
  if (!isBillingPlanId(plan)) return json({ error: 'Offre inconnue.' }, 422);
  const planDef = BILLING_PLANS[plan];

  // Identité dérivée du token (anti-usurpation).
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return json({ error: 'Session invalide.' }, 401);
  const user = userData.user;

  const priceId = process.env[planDef.priceEnvVar];
  if (!priceId) return json({ error: 'Tarif Stripe non configuré pour cette offre.' }, 503);

  // Audience gating (06_BILLING §1) : un plan n'est achetable que par sa persona vérifiée.
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: profile } = await admin.from('profiles').select('persona').eq('id', user.id).single();
  const persona = (profile?.persona as string | undefined) ?? 'public';
  if (planDef.persona !== persona) {
    return json({ error: "Cette offre n'est pas disponible pour votre profil." }, 403);
  }

  const appUrl = process.env.EXPO_PUBLIC_APP_URL ?? new URL(request.url).origin;

  try {
    const session = await createCheckoutSession(
      {
        plan,
        userId: user.id,
        customerEmail: user.email ?? '',
        successUrl: `${appUrl}/account?billing=success`,
        cancelUrl: `${appUrl}/pricing?billing=cancel`,
      },
      { secretKey: stripeSecret, priceId },
    );
    return json({ url: session.url }, 200);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Erreur Stripe.' }, 502);
  }
}
