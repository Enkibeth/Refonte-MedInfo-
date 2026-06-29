-- Migration 0027 — Dashboard de révision étudiant (ADR-0027).
--
-- Table own-row STRICTE : une ligne par plan de révision enregistré par l'étudiant.
-- Le plan complet (dates, jours indispo, capacité quotidienne, rythme, blocs de travail
-- avec leur avancement) est conservé en JSONB — comme un deck de présentation (ADR-0026),
-- un plan est un document autonome ; le moteur déterministe (src/revision/engine) le
-- recalcule côté client. Pas de table enfant : aucune requête SQL par bloc n'est nécessaire.
--
-- Donnée PÉDAGOGIQUE uniquement (volumes de travail, planning) — jamais de symptôme, de cas
-- patient ni de donnée de santé (safe-box non-MDSW). RLS own-row comme garde réelle.

create table if not exists public.revision_plans (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null default 'Mon plan de révision',
  exam_type   text not null default 'custom'
                check (exam_type in ('pass_las', 'dfgsm', 'edn', 'ecos', 'custom')),
  exam_date   date not null,
  plan        jsonb not null default '{}'::jsonb,   -- StoredPlan (cf src/revision/db/plans.ts)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists revision_plans_user_idx
  on public.revision_plans (user_id, updated_at desc);

alter table public.revision_plans enable row level security;

grant select, insert, update, delete on public.revision_plans to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='revision_plans' and policyname='revision_plans_select_own') then
    create policy revision_plans_select_own on public.revision_plans
      for select using ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='revision_plans' and policyname='revision_plans_insert_own') then
    create policy revision_plans_insert_own on public.revision_plans
      for insert with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='revision_plans' and policyname='revision_plans_update_own') then
    create policy revision_plans_update_own on public.revision_plans
      for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='revision_plans' and policyname='revision_plans_delete_own') then
    create policy revision_plans_delete_own on public.revision_plans
      for delete using ((select auth.uid()) = user_id);
  end if;
end $$;
