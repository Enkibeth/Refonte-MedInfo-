-- Migration 0017 — informations personnelles de profil (ADR-0021)
-- Permet à chaque utilisateur de renseigner prénom / nom / âge / sexe afin de PERSONNALISER
-- l'information générale du chat (registre, dépistages liés à l'âge/au sexe). Ces champs ne sont
-- PAS des données de santé (pas de symptôme, antécédent, traitement) et ne déclenchent aucun
-- diagnostic/anamnèse/triage : le safe-box non-MDSW reste entier (01_REGULATION §5).
--
-- Accès client : own-row (policies profiles existantes — l'utilisateur lit/écrit SA ligne).
-- Ces colonnes ne figurent PAS dans le verrou anti-élévation (0005/0016) : leur mise à jour par
-- l'utilisateur est donc autorisée, contrairement à persona/status/verified_personas.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name  text,
  ADD COLUMN IF NOT EXISTS age        smallint,
  ADD COLUMN IF NOT EXISTS sex        text;

-- Bornes de cohérence (défense en profondeur, en plus de la validation applicative).
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_age_range,
  ADD  CONSTRAINT profiles_age_range CHECK (age IS NULL OR (age >= 0 AND age <= 130));

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_sex_allowed,
  ADD  CONSTRAINT profiles_sex_allowed
    CHECK (sex IS NULL OR sex IN ('feminin', 'masculin', 'autre', 'non_precise'));

-- Longueur raisonnable des noms (anti-abus / cohérence UI).
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_name_length,
  ADD  CONSTRAINT profiles_name_length
    CHECK (
      (first_name IS NULL OR char_length(first_name) <= 60)
      AND (last_name IS NULL OR char_length(last_name) <= 60)
    );
