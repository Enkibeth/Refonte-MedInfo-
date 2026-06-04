-- Migration 0005 — vérification de rôle (ADR-0011)
-- Ajoute la traçabilité de vérification (aucune donnée de santé) et VERROUILLE l'auto-promotion :
-- persona/status ne peuvent être changés que par un rôle BYPASSRLS (service_role), jamais par
-- le client authentifié. Les rôles vérifiés sont écrits côté serveur (/api/role) après contrôle.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS verification_method text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

-- Garde anti-élévation : un rôle non BYPASSRLS (anon/authenticated) ne peut pas modifier
-- persona/status/verification. service_role (BYPASSRLS) passe → écriture serveur autorisée.
-- SECURITY INVOKER (défaut) : indispensable pour que current_user reflète le rôle appelant
-- (authenticated) et non le propriétaire de la fonction.
CREATE OR REPLACE FUNCTION public.prevent_self_role_elevation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.persona IS DISTINCT FROM OLD.persona
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.verification_method IS DISTINCT FROM OLD.verification_method
     OR NEW.verified_at IS DISTINCT FROM OLD.verified_at THEN
    -- Autorisé pour service_role (rolbypassrls) et superuser (rolsuper) ; bloqué pour
    -- anon/authenticated (ni l'un ni l'autre).
    IF NOT COALESCE(
      (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user),
      false
    ) THEN
      RAISE EXCEPTION 'persona/status modifiables uniquement apres verification (service_role)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Fonction non appelable en RPC direct (cf durcissement 0003).
REVOKE EXECUTE ON FUNCTION public.prevent_self_role_elevation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_prevent_self_role_elevation ON profiles;
CREATE TRIGGER trg_prevent_self_role_elevation
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_role_elevation();
