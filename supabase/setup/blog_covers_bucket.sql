-- Setup Supabase-spécifique (NON rejoué par le harness RLS CI — appliqué via MCP) :
-- bucket Storage PUBLIC `blog-covers` pour les images de couverture du blog (0022).
--
-- Écriture : service_role uniquement (l'upload se fait dans /api/admin/blog après
-- requireAdmin) — aucune policy d'écriture client. Lecture : publique (bucket public,
-- les URLs publiques sont servies directement par Storage).

INSERT INTO storage.buckets (id, name, public)
VALUES ('blog-covers', 'blog-covers', true)
ON CONFLICT (id) DO UPDATE SET public = true;
