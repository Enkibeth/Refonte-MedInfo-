-- Migration 0024 — Agent éditorial hebdomadaire du blog (ADR-0025).
--
--   1. blog_posts.source : provenance de l'article ('admin' = généré/écrit depuis le
--      panel admin, 'weekly_agent' = pipeline hebdomadaire /api/cron/weekly-blog).
--      Sert de garde anti-doublon (1 article d'agent max par fenêtre de 6 jours)
--      et de traçabilité dans le panel admin. Les policies RLS sont inchangées
--      (lecture publique des publiés uniquement, zéro écriture client).
--   2. Seed ai_model_config des 2 nouvelles étapes IA du pipeline (le POST admin
--      fait un UPDATE, les lignes doivent préexister — convention 0011) :
--      - blog_topic  : choix du sujet de la semaine (web_search ON : actualité santé) ;
--      - blog_review : relecture publish/revise/reject avant publication automatique.

ALTER TABLE blog_posts
  ADD COLUMN source text NOT NULL DEFAULT 'admin'
  CHECK (source IN ('admin', 'weekly_agent'));

INSERT INTO ai_model_config (key, model_id, label, provider, web_search) VALUES
  ('blog_topic',  'claude-sonnet-4-6', 'Blog — Choix du sujet hebdo',          'anthropic', true),
  ('blog_review', 'claude-sonnet-4-6', 'Blog — Relecture avant publication',   'anthropic', false)
ON CONFLICT (key) DO NOTHING;
