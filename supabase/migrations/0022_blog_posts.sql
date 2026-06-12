-- Migration 0022 — blog_posts (blog santé, articles générés par IA depuis le panel admin)
-- Audit landing 2026-06 : pages marketing (blog public) + module admin de génération.
--
-- Lecture PUBLIQUE (anon + authenticated) des articles PUBLIÉS uniquement ;
-- aucune écriture client : les insertions/publications passent par /api/admin/blog
-- (service_role après contrôle requireAdmin). Les brouillons sont invisibles du client.

CREATE TABLE blog_posts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text        NOT NULL UNIQUE,
  title           text        NOT NULL,
  summary         text,
  category        text,
  cover_image_url text,
  content_md      text        NOT NULL,
  status          text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  published_at    timestamptz
);

ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- Lecture publique des articles publiés uniquement (pas de policy INSERT/UPDATE/DELETE :
-- seules les écritures service_role — BYPASSRLS — sont possibles).
CREATE POLICY blog_posts_public_read ON blog_posts
  FOR SELECT
  USING (status = 'published');

CREATE INDEX blog_posts_published_idx ON blog_posts (status, published_at DESC);

-- Seed ai_model_config pour la feature « blog_generate » (le POST admin fait un UPDATE,
-- la ligne doit préexister — cf. 0011).
INSERT INTO ai_model_config (key, model_id, label, provider) VALUES
  ('blog_generate', 'claude-sonnet-4-6', 'Blog — Génération d''article', 'anthropic')
ON CONFLICT (key) DO NOTHING;
