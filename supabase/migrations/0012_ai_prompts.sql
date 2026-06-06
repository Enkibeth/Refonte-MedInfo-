-- Migration 0012 — ai_prompts (overrides admin des system prompts)
-- Lue par src/ai/prompts/promptStore.ts (cache 60s) et app/api/admin/config+api.ts.
-- SERVICE ROLE ONLY : jamais accessible au client, comme ai_interactions (0002).
-- RLS activée + AUCUNE policy + REVOKE anon/authenticated → table invisible/inécrivable
-- pour les rôles client ; seul service_role (BYPASSRLS, serveur/Edge) y accède.
--
-- PAS de seed : le code fallback sur PROMPT_DEFAULTS (fichiers TS versionnés) et le POST
-- admin fait un upsert. La table reste vide tant qu'aucun prompt n'a été personnalisé ;
-- chaque ligne est un override du défaut code.

CREATE TABLE ai_prompts (
  key        text        PRIMARY KEY,
  label      text        NOT NULL,
  template   text        NOT NULL,
  scope      text        NOT NULL,
  version    text        NOT NULL DEFAULT '1.0.0',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- SERVICE ROLE ONLY (cf 0002_ai_interactions / policies/ai_interactions.sql).
ALTER TABLE ai_prompts ENABLE ROW LEVEL SECURITY;

-- Pas de GRANT à anon/authenticated : volontaire. Ne PAS ajouter de policy client ici.
REVOKE ALL ON ai_prompts FROM anon, authenticated;
