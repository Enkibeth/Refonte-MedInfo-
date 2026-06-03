-- Shim auth — TEST ONLY. Ne PAS committer dans supabase/migrations/.
-- Réplique le minimum de l'environnement Supabase que le cluster jetable n'a pas :
-- rôles applicatifs, schéma `auth`, table `auth.users`, fonction `auth.uid()`.
-- Sur le vrai Supabase, tout ceci existe déjà : les migrations/policies n'en dépendent
-- donc que par nom (auth.uid(), auth.users), jamais par création.

-- Rôles Supabase (sur le cluster de test ils sont NOLOGIN : le superuser fait SET ROLE).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END
$$;

CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

-- Sous-ensemble de auth.users suffisant pour le FK profiles + le trigger handle_new_user.
CREATE TABLE IF NOT EXISTS auth.users (
  id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text
);

-- auth.uid() lit le claim JWT 'sub' posé par le harness (set_config request.jwt.claims).
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(
    current_setting('request.jwt.claims', true)::json ->> 'sub',
    ''
  )::uuid
$$;
