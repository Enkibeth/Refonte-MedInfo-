-- Migration 0003 — durcissement de handle_new_user()
-- L'advisor sécurité Supabase signale qu'une fonction SECURITY DEFINER exposée dans le
-- schéma `public` est appelable par anon/authenticated via PostgREST (/rest/v1/rpc/).
-- On révoque EXECUTE : le trigger `on_auth_user_created` continue de l'exécuter (l'appel
-- par trigger ne requiert pas le privilège EXECUTE), mais l'appel RPC direct est bloqué.

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
