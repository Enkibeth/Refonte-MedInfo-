-- Migration 0011 — ai_model_config (config modèles IA par feature)
-- SERVICE ROLE ONLY : table de configuration admin, jamais exposée au client.
-- RLS activée SANS policy : anon/authenticated refusés ; service_role (BYPASSRLS) accède.
--
-- Le code (featureModel.ts, config+api.ts) fait un UPDATE .eq('key', …) pour changer
-- le modèle → les 6 lignes doivent être seedées dès la création (pas de upsert côté POST).

CREATE TABLE public.ai_model_config (
  key        text PRIMARY KEY,
  model_id   text        NOT NULL,
  provider   text        NOT NULL,
  label      text        NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS : activée sans policy → accès service_role uniquement (pattern identique à ai_interactions)
ALTER TABLE public.ai_model_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_model_config FROM anon, authenticated;

-- Seed des 6 features (valeurs alignées sur FEATURE_DEFAULTS dans featureModel.ts)
INSERT INTO public.ai_model_config (key, model_id, provider, label) VALUES
  ('chat',          'claude-sonnet-4-6', 'anthropic', 'Chat'),
  ('analyze',       'claude-sonnet-4-6', 'anthropic', 'Analyse de document'),
  ('ecos_simulate', 'claude-sonnet-4-6', 'anthropic', 'ECOS — Simulation patient'),
  ('ecos_evaluate', 'claude-sonnet-4-6', 'anthropic', 'ECOS — Évaluation'),
  ('audio_diarize', 'gpt-4o-mini',       'openai',    'Audio — Diarisation'),
  ('audio_report',  'gpt-4o-mini',       'openai',    'Audio — Compte rendu');
