-- Migration 0008 — billing_events (idempotence webhook Stripe, 06_BILLING §6, ADR-0012)
-- Déduplication des événements Stripe : un même event.id n'est traité qu'une fois.
-- AUCUNE donnée de santé, aucun contenu de message. SERVICE ROLE ONLY (modèle ai_interactions) :
-- RLS activée SANS policy + REVOKE client (cf supabase/policies/billing_events.sql).

CREATE TABLE billing_events (
  stripe_event_id text PRIMARY KEY,
  type            text        NOT NULL,
  received_at     timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON billing_events TO service_role;
