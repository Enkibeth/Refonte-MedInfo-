-- Migration 0028 — Coup de pouce IA du dashboard de révision (ADR-0027, phase 2).
--
-- Seed ai_model_config de la feature "revision_plan_assist" (route /api/revision) : un
-- coach d'ORGANISATION pédagogique qui propose des ajustements de planning. Le POST admin
-- fait un UPDATE : la ligne doit préexister (convention 0011). Modèle par défaut :
-- Claude Sonnet 4.6 (anthropic).
--
-- Aucune nouvelle table : la suggestion n'est pas archivée (information d'organisation, pas
-- de donnée de santé). L'autorisation (étudiant/admin) est dérivée du profil vérifié dans
-- la route API (resolveChatPersona), jamais du body. L'IA n'invente aucun volume/item/rang.

INSERT INTO ai_model_config (key, model_id, label, provider, web_search) VALUES
  ('revision_plan_assist', 'claude-sonnet-4-6', 'Révisions — Coup de pouce planning', 'anthropic', false)
ON CONFLICT (key) DO NOTHING;
