-- Migration 0014 — quotas d'usage PAR FEATURE (06_BILLING §1, ADR-0012).
--
-- Contexte : 0004_usage_counters traque un compteur JOURNALIER GLOBAL par persona
-- (rate-limit anti-abus du chat). 0014 ajoute des quotas MENSUELS PAR FEATURE
-- (analyses, ECOS, minutes audio…) modulés par le plan d'abonnement. Les deux coexistent :
-- 0004 reste le garde-fou anti-flood ; 0014 porte les quotas produit (freemium tiered).
--
-- Compteurs TECHNIQUES uniquement : (user_id, feature_key, mois) → entier consommé.
-- AUCUNE donnée de santé, aucun contenu de message, prompt ou transcription stocké.
--
-- INVARIANT 06_BILLING §5 (critique) : ces quotas ne gèrent QUE le VOLUME. Ils ne gating
-- JAMAIS l'accès aux sources (HAS/ANSM restent gratuites et visibles pour tous).
--
-- Le statut payant provient EXCLUSIVEMENT de la table `subscriptions` (webhook Stripe signé,
-- service_role). Le client ne peut pas l'influencer.
--
-- RLS (cf. supabase/policies/feature_usage_counters.sql) : lecture OWN-ROW pour le rôle
-- `authenticated` (un user voit sa propre consommation), AUCUNE écriture client
-- (anti-tampering, même doctrine que 0004/0007 : seul service_role écrit, via la RPC ci-dessous).
--
-- NE TOUCHE PAS 0011/0012/0013.

CREATE TABLE feature_usage_counters (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  user_id       uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  -- Clé fonctionnelle de haut niveau : 'chat' | 'analyze' | 'ecos' | 'audio'.
  feature_key   text        NOT NULL,
  -- Période = 1er jour du mois (UTC). Le reset est implicite : un nouveau mois = nouvelle ligne.
  period_month  date        NOT NULL DEFAULT date_trunc('month', (now() AT TIME ZONE 'utc'))::date,
  -- Unité dépendante de la feature : nb de messages/analyses/ECOS, ou minutes audio.
  consumed      int         NOT NULL DEFAULT 0 CHECK (consumed >= 0),
  last_consumed_at timestamptz NOT NULL DEFAULT now()
);

-- Un seul compteur par (user, feature, mois) → upsert atomique via la RPC.
CREATE UNIQUE INDEX feature_usage_counters_user_feature_month_key
  ON feature_usage_counters (user_id, feature_key, period_month);

CREATE INDEX feature_usage_counters_user_month_idx
  ON feature_usage_counters (user_id, period_month);

GRANT SELECT, INSERT, UPDATE ON feature_usage_counters TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- consume_feature_quota — vérifie le quota du plan ET incrémente ATOMIQUEMENT.
--
-- Sémantique « check-and-consume » : on ne consomme QUE si l'opération laisse le compteur
-- sous (ou égal à) la limite. En cas de dépassement, AUCUNE écriture n'est faite et la
-- fonction renvoie allowed=false avec l'état courant. Le verrou FOR UPDATE sérialise les
-- appels concurrents sur la même ligne (atomicité multi-process).
--
-- p_limit < 0 est interprété comme ILLIMITÉ (le serveur court-circuite normalement avant
-- d'appeler la RPC pour les plans illimités ; ce garde-fou évite tout faux refus).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION consume_feature_quota(
  p_user_id     uuid,
  p_feature_key text,
  p_period      date,
  p_amount      int,
  p_limit       int
)
RETURNS TABLE (
  allowed   boolean,
  consumed  int,
  quota     int,
  remaining int,
  reset_at  timestamptz
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_current int;
  v_new     int;
  v_reset   timestamptz := (date_trunc('month', p_period::timestamptz) + interval '1 month');
BEGIN
  IF p_amount < 1 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  SELECT fuc.consumed INTO v_current
    FROM feature_usage_counters fuc
   WHERE fuc.user_id = p_user_id
     AND fuc.feature_key = p_feature_key
     AND fuc.period_month = p_period
     FOR UPDATE;

  IF NOT FOUND THEN
    v_current := 0;
  END IF;

  -- Limite négative → illimité : on consomme sans plafond.
  IF p_limit >= 0 AND v_current + p_amount > p_limit THEN
    RETURN QUERY SELECT
      false,
      v_current,
      p_limit,
      GREATEST(p_limit - v_current, 0),
      v_reset;
    RETURN;
  END IF;

  INSERT INTO feature_usage_counters (user_id, feature_key, period_month, consumed, last_consumed_at, updated_at)
  VALUES (p_user_id, p_feature_key, p_period, p_amount, now(), now())
  ON CONFLICT (user_id, feature_key, period_month)
  DO UPDATE SET
    consumed = feature_usage_counters.consumed + p_amount,
    last_consumed_at = now(),
    updated_at = now()
  RETURNING feature_usage_counters.consumed INTO v_new;

  RETURN QUERY SELECT
    true,
    v_new,
    p_limit,
    CASE WHEN p_limit < 0 THEN 2147483647 ELSE GREATEST(p_limit - v_new, 0) END,
    v_reset;
END;
$$;

REVOKE ALL ON FUNCTION consume_feature_quota(uuid, text, date, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION consume_feature_quota(uuid, text, date, int, int) TO service_role;
