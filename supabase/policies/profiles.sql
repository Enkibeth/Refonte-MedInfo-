-- RLS — profiles (03_SECURITY §2). Isolation cross-user testée dans tests/rls/isolation.test.ts.
-- Un user ne voit/modifie QUE sa propre ligne (auth.uid() = id).

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Privilèges de table : on accorde les droits aux rôles client pour que l'isolation soit
-- assurée par la RLS (et non par un simple GRANT manquant). anon n'a aucun accès profils.
GRANT SELECT, INSERT, UPDATE, DELETE ON profiles TO authenticated;

-- Note perf : auth.uid() est encapsulé dans (select …) pour n'être évalué qu'une fois
-- par requête et non par ligne (advisor auth_rls_initplan). Isolation inchangée.
CREATE POLICY "users read own profile"
  ON profiles FOR SELECT
  USING ((select auth.uid()) = id);

CREATE POLICY "users insert own profile"
  ON profiles FOR INSERT
  WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "users update own profile"
  ON profiles FOR UPDATE
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "users delete own profile"
  ON profiles FOR DELETE
  USING ((select auth.uid()) = id);
