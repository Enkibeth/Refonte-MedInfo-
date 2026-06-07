-- Migration 0017 — Analyseur de partiel (feature IA `partiel_analyze`)
-- Ajoute la ligne de config admin pour la nouvelle fonctionnalité IA, cohérente avec
-- FEATURE_DEFAULTS (featureModel.ts) et AI_FEATURES (src/admin/index.ts).
--
-- Le POST admin (/api/admin/config) fait un UPDATE … WHERE key = … : la ligne doit
-- préexister, sinon la sauvegarde admin est un no-op (cf 0011). Les colonnes de réglages
-- (temperature, reasoning_effort, verbosity, web_search) ajoutées par 0015 prennent leurs
-- valeurs par défaut (NULL / false).
--
-- SERVICE ROLE ONLY : héritage du verrou RLS de ai_model_config (0011) — pas de policy
-- client, REVOKE anon/authenticated déjà en place. Idempotent.

INSERT INTO ai_model_config (key, model_id, provider, label) VALUES
  ('partiel_analyze', 'claude-sonnet-4-6', 'anthropic', 'Analyseur de partiel')
ON CONFLICT (key) DO NOTHING;
