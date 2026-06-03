-- Migration 0002 — ai_interactions (audit, 03_SECURITY §6)
-- SERVICE ROLE ONLY : jamais accessible au client. Aucun contenu de message en clair,
-- aucune donnée de santé identifiable (preuve de conformité ANSM/CNIL).
-- RLS : activée SANS policy (cf supabase/policies/ai_interactions.sql) → tout rôle client
-- (anon/authenticated) est refusé ; seul service_role (BYPASSRLS) accède.

CREATE TABLE ai_interactions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  user_id           uuid,            -- nullable (public anonyme)
  persona           text NOT NULL,   -- public | student | professional
  model_used        text NOT NULL,
  tokens_in         int,
  tokens_out        int,
  latency_ms        int,
  refusal_triggered boolean NOT NULL DEFAULT false,
  guardrail_layer   text,            -- classifier | prompt | output_validation | none
  intent_category   text             -- general_info | personal_symptoms | emergency | out_of_scope | ambiguous
);
