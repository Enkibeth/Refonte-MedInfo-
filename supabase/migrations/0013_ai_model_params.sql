-- Migration 0013 — paramètres de génération par fonctionnalité IA (panel admin)
-- Étend ai_model_config (0011) avec les réglages réglables par feature :
--   - temperature      : créativité (0–2). NULL = défaut provider.
--   - reasoning_effort  : effort de raisonnement ('minimal'|'low'|'medium'|'high').
--                         OpenAI (gpt-5.x) → reasoningEffort ; Anthropic → budget thinking.
--   - verbosity         : longueur de réponse ('low'|'medium'|'high'). OpenAI gpt-5.x.
--   - web_search        : autorise l'outil de recherche internet du provider.
--
-- Réglages PAR FONCTIONNALITÉ (clé = feature), cohérent avec ai_model_config.
-- Lus par src/ai/providers/featureModel.ts (getFeatureSettings) et appliqués au call
-- LLM par src/ai/providers/featureRuntime.ts.
--
-- SERVICE ROLE ONLY : la table ai_model_config porte déjà RLS active sans policy +
-- REVOKE anon/authenticated (0011) ; les nouvelles colonnes héritent de ce verrou.
-- Pas de fonction ici → aucun search_path à figer (hardening 0010 respecté).

ALTER TABLE ai_model_config
  ADD COLUMN IF NOT EXISTS temperature      real,
  ADD COLUMN IF NOT EXISTS reasoning_effort text,
  ADD COLUMN IF NOT EXISTS verbosity        text,
  ADD COLUMN IF NOT EXISTS web_search       boolean NOT NULL DEFAULT false;

-- Garde-fous de domaine (cohérents avec la validation API admin).
ALTER TABLE ai_model_config
  ADD CONSTRAINT ai_model_config_temperature_range
    CHECK (temperature IS NULL OR (temperature >= 0 AND temperature <= 2)),
  ADD CONSTRAINT ai_model_config_reasoning_effort_valid
    CHECK (reasoning_effort IS NULL OR reasoning_effort IN ('minimal', 'low', 'medium', 'high')),
  ADD CONSTRAINT ai_model_config_verbosity_valid
    CHECK (verbosity IS NULL OR verbosity IN ('low', 'medium', 'high'));
