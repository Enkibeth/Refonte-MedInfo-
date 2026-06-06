-- Migration 0016 — ai_prompts_history (versionnement des system prompts)
-- Snapshot immuable de chaque version d'un prompt avant qu'elle ne soit écrasée par
-- le panel admin (cf ai_prompts, migration 0012). Permet rollback + diff côté admin.
--
-- Écrite par app/api/admin/config+api.ts (POST type=prompt → snapshot de l'ancienne
-- version ; POST type=restore_prompt → snapshot de la version courante avant restauration).
-- Lue par le GET admin (?history=<key>).
--
-- SERVICE ROLE ONLY : même posture que ai_prompts / ai_interactions (0002, 0012).
-- RLS activée + AUCUNE policy + REVOKE anon/authenticated → table invisible/inécrivable
-- pour les rôles client ; seul service_role (BYPASSRLS, serveur/Edge) y accède.

CREATE TABLE ai_prompts_history (
  id         bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key        text        NOT NULL,
  template   text        NOT NULL,
  version    text        NOT NULL,
  author     text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Une version donnée d'un prompt n'est snapshotée qu'une seule fois.
CREATE UNIQUE INDEX ai_prompts_history_key_version_idx
  ON ai_prompts_history (key, version);

-- Tri chronologique par prompt (liste des versions côté admin).
CREATE INDEX ai_prompts_history_key_created_idx
  ON ai_prompts_history (key, created_at DESC);

-- SERVICE ROLE ONLY (cf 0012_ai_prompts / 0002_ai_interactions).
ALTER TABLE ai_prompts_history ENABLE ROW LEVEL SECURITY;

-- Pas de GRANT à anon/authenticated : volontaire. Ne PAS ajouter de policy client ici.
REVOKE ALL ON ai_prompts_history FROM anon, authenticated;
