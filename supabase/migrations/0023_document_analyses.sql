-- Migration 0023 — Historique des analyses de documents (outil "Analyse de document").
--
-- Une ligne par analyse/traduction produite par /api/analyze. ⚠️ Le document fourni
-- (texte collé, PDF, photo) n'est JAMAIS conservé : seuls le RÉSULTAT généré par l'IA,
-- le mode (analyse/traduction), le nom du fichier source et la langue cible éventuelle
-- sont archivés. Résultat potentiellement sensible (contenu de santé) : RLS STRICTE
-- own-row, aucune lecture croisée.

create table if not exists public.document_analyses (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  mode            text not null default 'analysis'
                    check (mode in ('analysis', 'translation')),
  source_name     text,                                  -- nom du fichier ou « Texte collé » (jamais le contenu)
  target_language text,                                  -- langue cible (mode traduction)
  result          text not null,                         -- le résultat IA, seule donnée conservée
  created_at      timestamptz not null default now()
);

create index if not exists document_analyses_user_idx
  on public.document_analyses (user_id, created_at desc);

alter table public.document_analyses enable row level security;

grant select, insert, delete on public.document_analyses to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='document_analyses' and policyname='doc_analysis_select_own') then
    create policy doc_analysis_select_own on public.document_analyses
      for select using ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='document_analyses' and policyname='doc_analysis_insert_own') then
    create policy doc_analysis_insert_own on public.document_analyses
      for insert with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='document_analyses' and policyname='doc_analysis_delete_own') then
    create policy doc_analysis_delete_own on public.document_analyses
      for delete using ((select auth.uid()) = user_id);
  end if;
end $$;
