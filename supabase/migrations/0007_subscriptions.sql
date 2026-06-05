-- Migration 0007 — subscriptions (facturation Stripe web-first, 06_BILLING §6, ADR-0012)
-- ZÉRO donnée de santé : uniquement id client/abonnement Stripe, plan, statut, dates.
-- L'e-mail vit déjà dans auth.users : on ne le duplique pas ici (minimisation RGPD).
--
-- Le webhook Stripe SIGNÉ (service_role) est la SEULE source de vérité du statut payant.
-- Le client ne peut JAMAIS s'attribuer un plan payant : RLS lecture own-row, AUCUNE écriture
-- client (même doctrine anti-auto-promotion qu'ADR-0011). Prouvé par
-- tests/rls/billing-isolation.test.ts. RLS détaillée : supabase/policies/subscriptions.sql.
--
-- Pas de plan « pro » ici : les tiers professionnels restent gelés (ADR-0006, 06_BILLING §1).

CREATE TYPE billing_plan AS ENUM ('public_mid', 'student_mid', 'student_premium');

CREATE TYPE subscription_status AS ENUM (
  'active',
  'trialing',
  'past_due',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'unpaid'
);

CREATE TABLE subscriptions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  stripe_customer_id     text NOT NULL,
  stripe_subscription_id text,
  plan                   billing_plan        NOT NULL,
  status                 subscription_status NOT NULL DEFAULT 'incomplete',
  current_period_end     timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX subscriptions_user_idx ON subscriptions (user_id);
CREATE INDEX subscriptions_customer_idx ON subscriptions (stripe_customer_id);

-- Écriture réservée au serveur (webhook Stripe). Aucun GRANT d'écriture aux rôles client.
GRANT SELECT, INSERT, UPDATE ON subscriptions TO service_role;
