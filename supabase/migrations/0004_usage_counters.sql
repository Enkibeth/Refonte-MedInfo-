-- Migration 0004 — usage_counters (rate limiting, 03_SECURITY §3)
-- Compteurs techniques journaliers uniquement : user/persona ou IP hash/persona.
-- AUCUNE donnée de santé, aucun contenu de message, aucun prompt/réponse stocké.
-- RLS : service_role only (cf. supabase/policies/usage_counters.sql).

CREATE TABLE usage_counters (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  window_date       date        NOT NULL DEFAULT CURRENT_DATE,
  counter_key       text        NOT NULL,
  identity_type     text        NOT NULL CHECK (identity_type IN ('user', 'ip')),
  user_id           uuid        REFERENCES auth.users (id) ON DELETE CASCADE,
  ip_hash           text,
  persona           persona     NOT NULL,
  daily_count       int         NOT NULL DEFAULT 0 CHECK (daily_count >= 0),
  last_increment_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (identity_type = 'user' AND user_id IS NOT NULL AND ip_hash IS NULL)
    OR
    (identity_type = 'ip' AND user_id IS NULL AND ip_hash IS NOT NULL)
  )
);

CREATE UNIQUE INDEX usage_counters_counter_persona_day_key
  ON usage_counters (counter_key, persona, window_date);

CREATE INDEX usage_counters_user_day_idx
  ON usage_counters (user_id, persona, window_date)
  WHERE identity_type = 'user';

CREATE INDEX usage_counters_ip_day_idx
  ON usage_counters (ip_hash, persona, window_date)
  WHERE identity_type = 'ip';

GRANT SELECT, INSERT, UPDATE ON usage_counters TO service_role;

CREATE OR REPLACE FUNCTION increment_usage_counter(
  p_counter_key text,
  p_identity_type text,
  p_user_id uuid,
  p_ip_hash text,
  p_persona persona,
  p_window_date date,
  p_daily_limit int
)
RETURNS TABLE (
  allowed boolean,
  daily_count int,
  daily_limit int,
  remaining int,
  reset_at timestamptz
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_count int;
BEGIN
  IF p_daily_limit < 1 THEN
    RAISE EXCEPTION 'daily limit must be positive';
  END IF;

  INSERT INTO usage_counters (
    counter_key,
    identity_type,
    user_id,
    ip_hash,
    persona,
    window_date,
    daily_count,
    last_increment_at,
    updated_at
  )
  VALUES (
    p_counter_key,
    p_identity_type,
    p_user_id,
    p_ip_hash,
    p_persona,
    p_window_date,
    1,
    now(),
    now()
  )
  ON CONFLICT (counter_key, persona, window_date)
  DO UPDATE SET
    daily_count = usage_counters.daily_count + 1,
    last_increment_at = now(),
    updated_at = now()
  RETURNING usage_counters.daily_count INTO v_count;

  RETURN QUERY SELECT
    v_count <= p_daily_limit,
    v_count,
    p_daily_limit,
    GREATEST(p_daily_limit - v_count, 0),
    (p_window_date + 1)::timestamptz;
END;
$$;

REVOKE ALL ON FUNCTION increment_usage_counter(text, text, uuid, text, persona, date, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_usage_counter(text, text, uuid, text, persona, date, int) TO service_role;
