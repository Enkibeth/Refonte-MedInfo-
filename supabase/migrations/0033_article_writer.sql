-- Migration 0033 — Module Rédaction d'article médical (étudiants + professionnels, ADR-0031).
--
-- 1) Table own-row STRICTE `article_documents` : une ligne par manuscrit enregistré par
--    l'utilisateur (article original IMRaD, abstract, cas clinique, revue, thèse).
--    Conserve le document complet (JSON : métadonnées, sections, références, checklist —
--    cf src/article/articleDocument.ts). CRUD complet par le SEUL propriétaire (client
--    Supabase scopé au token → RLS, route /api/article-docs).
--
--    Un manuscrit est un travail scientifique de son auteur : pas un dossier patient
--    (l'UI rappelle de ne jamais y inclure de données identifiantes de patients).
--    RLS own-row comme garde réelle. Test : tests/rls/article-documents.test.ts.
--
-- 2) Seeds ai_model_config des 3 features IA du module (route /api/article) :
--      - article_assist      : aide à la rédaction d'une section (jamais de fait inventé) ;
--      - article_reduce      : réduction à la limite de caractères/mots imposée ;
--      - article_originality : contrôle d'originalité (recherche web ON — comparaison aux
--                              sources publiées, indicatif, ne remplace pas un anti-plagiat).
--    Le POST admin fait un UPDATE : les lignes doivent préexister (convention 0011).

-- ── 1) Table article_documents ──────────────────────────────────────────────
create table if not exists public.article_documents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text,
  doc_type    text not null default 'original'
              check (doc_type in ('original', 'abstract', 'case_report', 'review', 'thesis')),
  document    jsonb not null default '{}'::jsonb,   -- manuscrit complet (cf src/article/articleDocument.ts)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists article_documents_user_idx
  on public.article_documents (user_id, updated_at desc);

alter table public.article_documents enable row level security;

grant select, insert, update, delete on public.article_documents to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='article_documents' and policyname='article_documents_select_own') then
    create policy article_documents_select_own on public.article_documents
      for select using ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='article_documents' and policyname='article_documents_insert_own') then
    create policy article_documents_insert_own on public.article_documents
      for insert with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='article_documents' and policyname='article_documents_update_own') then
    create policy article_documents_update_own on public.article_documents
      for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='article_documents' and policyname='article_documents_delete_own') then
    create policy article_documents_delete_own on public.article_documents
      for delete using ((select auth.uid()) = user_id);
  end if;
end $$;

-- ── 2) Seeds features IA du module ──────────────────────────────────────────
INSERT INTO ai_model_config (key, model_id, label, provider, web_search) VALUES
  ('article_assist',      'claude-sonnet-4-6', 'Article — Aide à la rédaction',      'anthropic', false),
  ('article_reduce',      'claude-sonnet-4-6', 'Article — Réduction de caractères',  'anthropic', false),
  ('article_originality', 'claude-sonnet-4-6', 'Article — Contrôle d''originalité',  'anthropic', true)
ON CONFLICT (key) DO NOTHING;
