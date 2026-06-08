-- Migration 0019 — audio_documents : bibliothèque des transcriptions / comptes rendus audio.
--
-- Conservation (ADR-0022) :
--   - transcription + compte rendu : CONSERVÉS indéfiniment (texte, éditable/classable/supprimable) ;
--   - audio source : CONSERVÉ ≤ 24h (champ audio_path + audio_expires_at), purgé par un job
--     planifié côté Supabase (cf. supabase/setup/audio_storage_and_purge.sql — hors harness CI).
--
-- Donnée potentiellement sensible (consultation) : RLS STRICTE own-row, aucune lecture croisée.
-- Le client n'accède qu'à SES documents (auth.uid() = user_id). Écriture/maj/suppression par le
-- propriétaire. Aucune élévation : pas de colonne de rôle ici.

create table if not exists public.audio_documents (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  title            text not null default 'Compte rendu',
  folder           text,                                  -- classement libre (dossier), nullable
  kind             text not null default 'report'         -- 'transcription' | 'report'
                     check (kind in ('transcription', 'report')),
  transcription    text not null default '',
  report           text,
  audio_path       text,                                  -- chemin Storage ({user_id}/{id}.webm), null après purge
  audio_expires_at timestamptz,                            -- échéance de purge de l'audio (création + 24h)
  duration_seconds int check (duration_seconds is null or duration_seconds >= 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists audio_documents_user_idx
  on public.audio_documents (user_id, created_at desc);

alter table public.audio_documents enable row level security;

-- Privilèges client : l'isolation est assurée par la RLS own-row ci-dessous.
grant select, insert, update, delete on public.audio_documents to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='audio_documents' and policyname='audio_docs_select_own') then
    create policy audio_docs_select_own on public.audio_documents
      for select using ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='audio_documents' and policyname='audio_docs_insert_own') then
    create policy audio_docs_insert_own on public.audio_documents
      for insert with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='audio_documents' and policyname='audio_docs_update_own') then
    create policy audio_docs_update_own on public.audio_documents
      for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='audio_documents' and policyname='audio_docs_delete_own') then
    create policy audio_docs_delete_own on public.audio_documents
      for delete using ((select auth.uid()) = user_id);
  end if;
end $$;
