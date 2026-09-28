-- 0047 — Ferme la purge audio aux appels publics (conseiller sécurité Supabase, 2026-09-28).
--
-- `public.purge_expired_consultation_audio()` (SECURITY DEFINER, créée par
-- supabase/setup/audio_storage_and_purge.sql, hors harness) était exécutable par `anon` et
-- `authenticated` via /rest/v1/rpc. Impact limité (elle ne supprime que l'audio déjà expiré),
-- mais aucun client n'a à l'appeler : seul le job pg_cron (rôle postgres) l'exécute.
--
-- Conditionnel : la fonction n'existe que sur le projet réel (setup hors harness), la
-- migration reste rejouable sur une base vierge.
DO $$
BEGIN
  IF to_regprocedure('public.purge_expired_consultation_audio()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.purge_expired_consultation_audio() FROM PUBLIC, anon, authenticated;
  END IF;
END
$$;
