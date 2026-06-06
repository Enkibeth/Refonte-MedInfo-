-- Migration 0012 — ai_prompts (overrides de prompts système via admin)
-- SERVICE ROLE ONLY : table de configuration admin, jamais exposée au client.
-- RLS activée SANS policy : anon/authenticated refusés ; service_role (BYPASSRLS) accède.
--
-- Pas de seed : le code (promptStore.ts) fallback sur les fichiers TS (PROMPT_DEFAULTS)
-- quand la table est vide, et le POST admin fait un upsert → la table démarre vide.
-- Seules les overrides explicites (admin panel) sont persistées ici.

CREATE TABLE public.ai_prompts (
  key        text PRIMARY KEY,
  label      text        NOT NULL,
  template   text        NOT NULL,
  scope      text        NOT NULL,
  version    text        NOT NULL DEFAULT '1.0.0',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS : activée sans policy → accès service_role uniquement (pattern identique à ai_interactions)
ALTER TABLE public.ai_prompts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_prompts FROM anon, authenticated;
