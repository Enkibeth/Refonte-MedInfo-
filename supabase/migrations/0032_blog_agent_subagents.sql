-- Migration 0032 — Sous-agents qualité du pipeline hebdo du blog (suivi ADR-0025).
--
-- Seed ai_model_config des 2 nouvelles étapes IA du pipeline /api/cron/weekly-blog
-- (le POST admin fait un UPDATE, les lignes doivent préexister — convention 0011) :
--   - blog_fact_check : vérification des faits, chiffres et sources citées de
--     l'article (web_search ON : confrontation aux sources réelles) ; rapport
--     transmis au relecteur final, fail-open (échec = « indisponible »).
--   - blog_copyedit   : relecture rédactionnelle (orthographe, style, structure ;
--     jamais les faits), fail-open.
-- La relecture finale blog_review reste la barrière fail-closed avant publication.
-- Aucune table ni policy RLS modifiée.

INSERT INTO ai_model_config (key, model_id, label, provider, web_search) VALUES
  ('blog_fact_check', 'claude-sonnet-4-6', 'Blog — Vérification des faits et sources', 'anthropic', true),
  ('blog_copyedit',   'claude-sonnet-4-6', 'Blog — Relecture rédactionnelle',          'anthropic', false)
ON CONFLICT (key) DO NOTHING;
