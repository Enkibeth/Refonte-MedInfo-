-- Setup Supabase-spécifique (HORS supabase/migrations/ : non rejoué par le harness RLS CI,
-- car dépend de `storage` et de l'extension pg_cron propres à Supabase).
-- À appliquer sur le projet Supabase (déjà appliqué via MCP en prod le 2026-06-08).
--
-- Objet : bucket privé pour l'audio de consultation + purge automatique à 24h (ADR-0022).

-- 1) Bucket privé pour les enregistrements de consultation.
insert into storage.buckets (id, name, public)
values ('consultation-audio', 'consultation-audio', false)
on conflict (id) do nothing;

-- 2) RLS Storage : chaque utilisateur n'accède qu'à SON dossier ({user_id}/...).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='consultation_audio_read_own') then
    create policy consultation_audio_read_own on storage.objects for select to authenticated
      using (bucket_id = 'consultation-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='consultation_audio_insert_own') then
    create policy consultation_audio_insert_own on storage.objects for insert to authenticated
      with check (bucket_id = 'consultation-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='consultation_audio_delete_own') then
    create policy consultation_audio_delete_own on storage.objects for delete to authenticated
      using (bucket_id = 'consultation-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;
end $$;

-- 3) Purge automatique de l'audio > 24h (le texte des comptes rendus est conservé).
create extension if not exists pg_cron;

create or replace function public.purge_expired_consultation_audio()
returns void
language plpgsql
security definer
set search_path = public, storage
as $$
begin
  -- Supprime les fichiers audio de plus de 24h du bucket.
  delete from storage.objects
    where bucket_id = 'consultation-audio'
      and created_at < now() - interval '24 hours';
  -- Détache la référence côté documents (le texte reste, l'audio est marqué expiré).
  update public.audio_documents
    set audio_path = null, updated_at = now()
    where audio_path is not null
      and audio_expires_at is not null
      and audio_expires_at < now();
end;
$$;

-- Planifie le job toutes les heures (idempotent).
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'purge-consultation-audio') then
    perform cron.schedule(
      'purge-consultation-audio',
      '7 * * * *',
      'select public.purge_expired_consultation_audio();'
    );
  end if;
end $$;
