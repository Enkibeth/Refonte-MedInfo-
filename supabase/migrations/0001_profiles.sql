-- Migration 0001 — profiles (table user, 02_ARCHITECTURE §4)
-- Aucune donnée de santé (01_REGULATION §5). Porte uniquement la persona + le statut de vérif.
-- RLS : définie dans supabase/policies/profiles.sql (1 policy = 1 fichier testé, §2).

CREATE TYPE persona AS ENUM ('public', 'student', 'professional');

CREATE TABLE profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  persona     persona     NOT NULL DEFAULT 'public',
  -- Statut de vérification (ADR-0007). 'unverified' au MVP ; pas de donnée santé.
  status      text        NOT NULL DEFAULT 'unverified',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Création automatique du profil au signup (persona 'public' par défaut).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
