-- Migration 0026 — Historique cloud des présentations (ADR-0026).
--
-- Table own-row STRICTE : une ligne par présentation enregistrée par l'utilisateur.
-- Conserve le deck spec (JSON pivot, mode manuel ET mode IA) + l'historique de
-- co-construction IA pour reprendre le travail là où il a été laissé (changement de
-- page, fermeture avant export). CRUD complet par le SEUL propriétaire.
--
-- Un deck = un support de présentation (information médicale générale, jamais un
-- dossier patient). Pas de donnée de santé identifiable. RLS own-row comme garde.

create table if not exists public.presentation_decks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text,
  theme       text not null default 'v2' check (theme in ('v1', 'v2', 'v3')),
  deck        jsonb not null default '{}'::jsonb,       -- deck spec complet (cf src/core schema)
  ai_history  jsonb not null default '[]'::jsonb,       -- échanges co-construction IA (reprise)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists presentation_decks_user_idx
  on public.presentation_decks (user_id, updated_at desc);

alter table public.presentation_decks enable row level security;

grant select, insert, update, delete on public.presentation_decks to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='presentation_decks' and policyname='presentation_decks_select_own') then
    create policy presentation_decks_select_own on public.presentation_decks
      for select using ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='presentation_decks' and policyname='presentation_decks_insert_own') then
    create policy presentation_decks_insert_own on public.presentation_decks
      for insert with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='presentation_decks' and policyname='presentation_decks_update_own') then
    create policy presentation_decks_update_own on public.presentation_decks
      for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='presentation_decks' and policyname='presentation_decks_delete_own') then
    create policy presentation_decks_delete_own on public.presentation_decks
      for delete using ((select auth.uid()) = user_id);
  end if;
end $$;
