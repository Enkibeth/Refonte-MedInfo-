-- RLS — ai_interactions (03_SECURITY §2, §6). SERVICE ROLE ONLY.
-- RLS activée + AUCUNE policy + AUCUN grant aux rôles client = table invisible/inécrivable
-- pour anon/authenticated. Seul service_role (BYPASSRLS, serveur/Edge) y accède.
-- Vérifié dans tests/rls/isolation.test.ts (le client doit échouer).

ALTER TABLE ai_interactions ENABLE ROW LEVEL SECURITY;

-- Pas de GRANT à anon/authenticated : volontaire. Ne PAS ajouter de policy client ici.
REVOKE ALL ON ai_interactions FROM anon, authenticated;
