-- Migration 0016 — multi-rôles vérifiés (extension d'ADR-0011)
-- Permet à un compte d'accumuler PLUSIEURS rôles vérifiés (ex : étudiant ET professionnel)
-- et de basculer librement entre les chats correspondants sans re-vérifier à chaque fois.
-- Aucune donnée de santé. La vérification + l'écriture restent serveur (service_role) : le
-- client ne s'auto-promeut jamais (verrou trigger ci-dessous).

-- Ensemble des personas DÉJÀ vérifiées pour ce compte. `public` est toujours acquis.
-- `persona` (colonne 0001) reste le rôle ACTIF ; il doit appartenir à `verified_personas`.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS verified_personas persona[] NOT NULL DEFAULT ARRAY['public']::persona[];

-- Backfill : un rôle non-public déjà vérifié (status='verified') est ajouté à l'ensemble.
UPDATE profiles
SET verified_personas = CASE
  WHEN status = 'verified' AND persona <> 'public' THEN ARRAY['public', persona]::persona[]
  ELSE ARRAY['public']::persona[]
END;

-- Garde anti-élévation : on étend le verrou 0005 pour couvrir `verified_personas`.
-- Seul un rôle BYPASSRLS (service_role) / superuser peut modifier persona/status/vérif.
CREATE OR REPLACE FUNCTION public.prevent_self_role_elevation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.persona IS DISTINCT FROM OLD.persona
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.verification_method IS DISTINCT FROM OLD.verification_method
     OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
     OR NEW.verified_personas IS DISTINCT FROM OLD.verified_personas THEN
    IF NOT COALESCE(
      (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user),
      false
    ) THEN
      RAISE EXCEPTION 'persona/status/verified_personas modifiables uniquement apres verification (service_role)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
