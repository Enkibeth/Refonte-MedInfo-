-- Migration 0016 — nouvelles fonctionnalités IA : ECOS (génération de cas) + Compte rendu (texte)
-- Seed obligatoire dans ai_model_config (0011) : le POST admin fait un UPDATE … WHERE key = …,
-- pas un upsert. Sans ces lignes, la config admin de ces features serait un no-op.
-- Doit matcher FEATURE_DEFAULTS (featureModel.ts) et AI_FEATURES (src/admin/index.ts).
--
-- SERVICE ROLE ONLY : ai_model_config porte déjà RLS active sans policy + REVOKE
-- anon/authenticated (0011). Les colonnes de réglages (0015) prennent leurs valeurs par défaut.
--
--  - ecos_generate   : génère un cas ECOS FICTIF à partir d'une station importée (ADR-0017/0020).
--  - report_generate : rédige un compte rendu structuré depuis des notes texte (ADR-0006/0020).

INSERT INTO ai_model_config (key, model_id, provider, label) VALUES
  ('ecos_generate',   'claude-sonnet-4-6', 'anthropic', 'ECOS — Génération de cas'),
  ('report_generate', 'claude-sonnet-4-6', 'anthropic', 'Compte rendu — Rédaction (texte)')
ON CONFLICT (key) DO NOTHING;
