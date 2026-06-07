-- RLS — ecos_cases (CC4, banque de cas ECOS pédagogiques fictifs). Miroir déclaratif de la
-- policy posée par supabase/migrations/0013_ecos_cases.sql. Même doctrine que rag_* (0006) :
-- lecture publique des cas PUBLIÉS uniquement, AUCUNE écriture client (service_role only).
-- Isolation (brouillons invisibles + écriture client refusée) testée dans tests/rls/ecos-cases.test.ts.
-- Contenu 100 % fictif : jamais de cas patient réel (CLAUDE.md, ADR-0017).

ALTER TABLE public.ecos_cases ENABLE ROW LEVEL SECURITY;

-- Lecture des cas publiés ouverte (anon + authenticated) : ce sont des vignettes pédagogiques.
-- Volontairement AUCUN GRANT INSERT/UPDATE/DELETE au client : seule la route admin (service_role)
-- crée/édite/publie un cas.
GRANT SELECT ON public.ecos_cases TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ecos_cases TO service_role;

DROP POLICY IF EXISTS ecos_cases_select_published ON public.ecos_cases;
CREATE POLICY ecos_cases_select_published
  ON public.ecos_cases FOR SELECT
  USING (is_published = true);
