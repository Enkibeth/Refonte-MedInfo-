-- GRANTs blog_posts (migration 0022) — appliqués aussi par le harness RLS CI.
-- Lecture publique (anon + authenticated) : la policy `blog_posts_public_read`
-- ne laisse passer que les articles `status = 'published'`.
-- Volontairement AUCUN GRANT INSERT/UPDATE/DELETE au client : seule la route admin
-- (/api/admin/blog, service_role après requireAdmin) écrit dans cette table.
GRANT SELECT ON public.blog_posts TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_posts TO service_role;
