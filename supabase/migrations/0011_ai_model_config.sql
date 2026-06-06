-- Migration 0011 — ai_model_config (configuration admin du modèle par fonctionnalité IA)
-- Lue par src/ai/providers/featureModel.ts (cache 60s) et app/api/admin/config+api.ts.
-- SERVICE ROLE ONLY : jamais accessible au client, comme ai_interactions (0002).
-- RLS activée + AUCUNE policy + REVOKE anon/authenticated → table invisible/inécrivable
-- pour les rôles client ; seul service_role (BYPASSRLS, serveur/Edge) y accède.
--
-- ⚠️  SEED OBLIGATOIRE : le POST admin (/api/admin/config) fait un UPDATE … WHERE key = …,
-- PAS un upsert. Les 6 lignes doivent donc préexister, sinon la sauvegarde admin est un no-op.
-- Les valeurs ci-dessous reflètent FEATURE_DEFAULTS dans featureModel.ts.

CREATE TABLE ai_model_config (
  key        text        PRIMARY KEY,
  model_id   text        NOT NULL,
  provider   text        NOT NULL,
  label      text        NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- SERVICE ROLE ONLY (cf 0002_ai_interactions / policies/ai_interactions.sql).
ALTER TABLE ai_model_config ENABLE ROW LEVEL SECURITY;

-- Pas de GRANT à anon/authenticated : volontaire. Ne PAS ajouter de policy client ici.
REVOKE ALL ON ai_model_config FROM anon, authenticated;

-- Seed des 6 fonctionnalités IA (doit matcher FEATURE_DEFAULTS dans featureModel.ts).
INSERT INTO ai_model_config (key, model_id, provider, label) VALUES
  ('chat',          'claude-sonnet-4-6', 'anthropic', 'Chat'),
  ('analyze',       'claude-sonnet-4-6', 'anthropic', 'Analyse de document'),
  ('ecos_simulate', 'claude-sonnet-4-6', 'anthropic', 'ECOS — Simulation patient'),
  ('ecos_evaluate', 'claude-sonnet-4-6', 'anthropic', 'ECOS — Évaluation'),
  ('audio_diarize', 'gpt-4o-mini',       'openai',    'Audio — Diarisation'),
  ('audio_report',  'gpt-4o-mini',       'openai',    'Audio — Compte rendu');
