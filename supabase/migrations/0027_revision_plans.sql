-- Migration 0027 — Planificateur de révisions étudiant (ADR-0027).
--
-- Deux tables own-row STRICTES :
--   - revision_plans       : un plan = une période (dates, plafond/jour, vitesse perso,
--     ratio tampon, révision espacée) appartenant à un utilisateur ;
--   - revision_plan_items  : les blocs de travail du plan (matière/collège/chapitre :
--     volumes pages/chapitres/QCM + progression réelle `completed_*` + priorité/maîtrise).
--
-- ⚠️ Périmètre (safe-box non-MDSW) : données PÉDAGOGIQUES et d'organisation du travail
-- uniquement. Aucune donnée de santé, aucun cas patient, aucun diagnostic. Les tâches
-- quotidiennes ne sont PAS stockées : elles sont dérivées de façon déterministe côté
-- client/serveur par le moteur (src/features/revision/engine). CRUD réservé au propriétaire.

create table if not exists public.revision_plans (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  title              text,
  exam_type          text not null default 'custom'
                       check (exam_type in ('pass_las', 'dfgsm', 'edn', 'ecos', 'custom')),
  start_date         date not null,
  exam_date          date not null,
  daily_max_minutes  int  not null default 180 check (daily_max_minutes between 15 and 1440),
  pages_per_hour     numeric not null default 8   check (pages_per_hour > 0),
  chapters_per_hour  numeric not null default 1.5 check (chapters_per_hour > 0),
  qcm_per_hour       numeric not null default 60  check (qcm_per_hour > 0),
  buffer_ratio       numeric not null default 0.1 check (buffer_ratio between 0 and 0.5),
  spaced_repetition  boolean not null default false,
  rest_weekdays      jsonb not null default '[]'::jsonb,   -- entiers 0..6 (0 = dimanche)
  unavailable_days   jsonb not null default '[]'::jsonb,   -- dates ISO exactes
  status             text not null default 'active' check (status in ('active', 'archived')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists revision_plans_user_idx
  on public.revision_plans (user_id, updated_at desc);

create table if not exists public.revision_plan_items (
  id                  uuid primary key default gen_random_uuid(),
  plan_id             uuid not null references public.revision_plans (id) on delete cascade,
  user_id             uuid not null references auth.users (id) on delete cascade,
  title               text not null,
  subject             text,                                  -- matière / collège (libre)
  pages               int not null default 0 check (pages >= 0),
  chapters            int not null default 0 check (chapters >= 0),
  qcm                 int not null default 0 check (qcm >= 0),
  priority            int not null default 2 check (priority between 1 and 3),
  completed_pages     int not null default 0 check (completed_pages >= 0),
  completed_chapters  int not null default 0 check (completed_chapters >= 0),
  completed_qcm       int not null default 0 check (completed_qcm >= 0),
  mastery             int not null default 0 check (mastery between 0 and 5),
  position            int not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists revision_plan_items_plan_idx
  on public.revision_plan_items (plan_id, position asc);

alter table public.revision_plans enable row level security;
alter table public.revision_plan_items enable row level security;

grant select, insert, update, delete on public.revision_plans to authenticated;
grant select, insert, update, delete on public.revision_plan_items to authenticated;

do $$
begin
  -- revision_plans : own-row strict
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

  -- revision_plan_items : own-row + appartenance à UN plan du même utilisateur (insert/update)
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='revision_plan_items' and policyname='revision_items_select_own') then
    create policy revision_items_select_own on public.revision_plan_items
      for select using ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='revision_plan_items' and policyname='revision_items_insert_own') then
    create policy revision_items_insert_own on public.revision_plan_items
      for insert with check (
        (select auth.uid()) = user_id
        and exists (
          select 1 from public.revision_plans p
          where p.id = plan_id and p.user_id = (select auth.uid())
        )
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='revision_plan_items' and policyname='revision_items_update_own') then
    create policy revision_items_update_own on public.revision_plan_items
      for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='revision_plan_items' and policyname='revision_items_delete_own') then
    create policy revision_items_delete_own on public.revision_plan_items
      for delete using ((select auth.uid()) = user_id);
  end if;
end $$;
