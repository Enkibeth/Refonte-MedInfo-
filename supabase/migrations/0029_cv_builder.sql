-- Migration 0029 — Module CV Builder (étudiants + professionnels, ADR-0028).
--
-- 1) Table own-row STRICTE `cv_documents` : une ligne par CV enregistré par l'utilisateur.
--    Conserve le document complet (JSON : identité, expériences, formation, recherche,
--    références, certificats, langues, intérêts, projets). CRUD complet par le SEUL
--    propriétaire (client Supabase scopé au token → RLS, route /api/cv-docs).
--
--    Un CV contient des DONNÉES PERSONNELLES (identité, parfois celles des référents).
--    Pas de donnée de santé. RLS own-row comme garde réelle.
--
-- 2) Seed ai_model_config de la feature IA "cv_review" (route /api/cv, relecture du CV).
--    Le POST admin fait un UPDATE : la ligne doit préexister (convention 0011). Modèle par
--    défaut : Claude Sonnet 4.6 (raisonnement structuré + JSON fiable pour le rapport).

-- ── 1) Table cv_documents ───────────────────────────────────────────────────
create table if not exists public.cv_documents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text,
  theme       text not null default 'medical' check (theme in ('medical')),
  document    jsonb not null default '{}'::jsonb,        -- CV complet (cf src/cv/cvDocument.ts)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists cv_documents_user_idx
  on public.cv_documents (user_id, updated_at desc);

alter table public.cv_documents enable row level security;

grant select, insert, update, delete on public.cv_documents to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cv_documents' and policyname='cv_documents_select_own') then
    create policy cv_documents_select_own on public.cv_documents
      for select using ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cv_documents' and policyname='cv_documents_insert_own') then
    create policy cv_documents_insert_own on public.cv_documents
      for insert with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cv_documents' and policyname='cv_documents_update_own') then
    create policy cv_documents_update_own on public.cv_documents
      for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cv_documents' and policyname='cv_documents_delete_own') then
    create policy cv_documents_delete_own on public.cv_documents
      for delete using ((select auth.uid()) = user_id);
  end if;
end $$;

-- ── 2) Seed feature IA cv_review ────────────────────────────────────────────
INSERT INTO ai_model_config (key, model_id, label, provider, web_search) VALUES
  ('cv_review', 'claude-sonnet-4-6', 'CV — Relecture IA', 'anthropic', false)
ON CONFLICT (key) DO NOTHING;
