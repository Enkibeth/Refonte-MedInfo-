-- Migration 0034 — Historique des passages ECOS (dashboard ECOS, ADR-0032).
--
-- Table own-row STRICTE : une ligne par passage (simulation + évaluation) d'un cas
-- ECOS par un étudiant. On conserve la note extraite du markdown (« x/20 », nullable
-- si introuvable — jamais inventée) et l'évaluation pédagogique complète pour la
-- reconsulter depuis le dashboard. La TRANSCRIPTION de la simulation n'est PAS
-- conservée : les cas sont des vignettes fictives (ADR-0017), on n'archive que le
-- feedback pédagogique. Donnée pédagogique — jamais de patient réel ni de santé.
--
-- Passage IMMUABLE : policies insert/select/delete propriétaire, PAS d'update
-- (ni policy ni grant) — une note ne se retouche pas après coup.

create table if not exists public.ecos_attempts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  case_slug   text not null,
  case_title  text not null,
  specialty   text not null default '',
  score       numeric(4,1) check (score >= 0 and score <= 20),
  evaluation  text not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists ecos_attempts_user_idx
  on public.ecos_attempts (user_id, created_at desc);

alter table public.ecos_attempts enable row level security;

grant select, insert, delete on public.ecos_attempts to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ecos_attempts' and policyname='ecos_attempts_select_own') then
    create policy ecos_attempts_select_own on public.ecos_attempts
      for select using ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ecos_attempts' and policyname='ecos_attempts_insert_own') then
    create policy ecos_attempts_insert_own on public.ecos_attempts
      for insert with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ecos_attempts' and policyname='ecos_attempts_delete_own') then
    create policy ecos_attempts_delete_own on public.ecos_attempts
      for delete using ((select auth.uid()) = user_id);
  end if;
end $$;
