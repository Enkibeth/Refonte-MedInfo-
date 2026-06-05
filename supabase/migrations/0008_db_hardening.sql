-- 0008 — Durcissement base (advisors Supabase), 0 impact réglementaire / fonctionnel.
-- Corrige deux familles d'alertes du linter Supabase :
--   1) function_search_path_mutable (SECURITY/WARN) : fige le search_path des fonctions
--      pour empêcher l'injection d'un schéma malveillant via le search_path de l'appelant.
--      On pin sur `public` (convention déjà utilisée par handle_new_user) : les fonctions
--      utilisent l'opérateur `<=>` (extension vector) et le type enum `persona`, tous deux
--      dans `public` — un search_path vide casserait leur résolution.
--   2) auth_rls_initplan (PERF/WARN) : remplace `auth.uid()` par `(select auth.uid())` dans
--      les policies de `profiles` pour évaluer la fonction une seule fois par requête au lieu
--      d'une fois par ligne. Sémantique d'isolation identique (toujours own-row).

-- 1) search_path figé sur les deux fonctions signalées.
alter function public.increment_usage_counter(
  text, text, uuid, text, public.persona, date, integer
) set search_path = public;

alter function public.match_rag_chunks(
  text, public.vector, integer
) set search_path = public;

-- 2) Réécriture des policies own-row de profiles avec (select auth.uid()).
drop policy if exists "users read own profile"   on public.profiles;
drop policy if exists "users insert own profile"  on public.profiles;
drop policy if exists "users update own profile"  on public.profiles;
drop policy if exists "users delete own profile"  on public.profiles;

create policy "users read own profile"
  on public.profiles for select
  using ((select auth.uid()) = id);

create policy "users insert own profile"
  on public.profiles for insert
  with check ((select auth.uid()) = id);

create policy "users update own profile"
  on public.profiles for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "users delete own profile"
  on public.profiles for delete
  using ((select auth.uid()) = id);
