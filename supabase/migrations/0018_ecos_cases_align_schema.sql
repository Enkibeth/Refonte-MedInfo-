-- Migration 0018 — réconciliation du schéma ecos_cases (corpus de cas ECOS).
--
-- Contexte : la base déployée a dérivé vers un schéma FRANÇAIS en texte
-- (titre/specialite/duree/consigne_candidat/brief_patient/grille_correction),
-- alors que le code (migration 0013, seed, data/ecos-cases.json, /api/admin/ecos-cases,
-- app/(chat)/ecos.tsx) attend le schéma ANGLAIS avec patient_profile/grading_grid en jsonb.
-- Résultat : « column ecos_cases.title does not exist » côté app + admin.
--
-- Cette migration aligne la base sur le schéma du dépôt SANS perdre de données :
-- elle ajoute les colonnes anglaises, recopie le contenu français, puis retire les
-- colonnes françaises. Idempotente : sur une base déjà conforme (créée par 0013),
-- toutes les opérations sont des no-op grâce aux gardes IF [NOT] EXISTS.

-- 1) Colonnes cibles (schéma dépôt) — ajout si absentes.
alter table public.ecos_cases
  add column if not exists title            text,
  add column if not exists specialty        text,
  add column if not exists duration_minutes int,
  add column if not exists brief            text,
  add column if not exists patient_profile  jsonb not null default '{}'::jsonb,
  add column if not exists grading_grid     jsonb not null default '{}'::jsonb;

-- 2) Recopie depuis les colonnes françaises si elles existent encore.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ecos_cases' and column_name = 'titre'
  ) then
    update public.ecos_cases set
      title            = coalesce(title, titre),
      specialty        = coalesce(specialty, specialite),
      duration_minutes = coalesce(duration_minutes, duree),
      brief            = coalesce(brief, consigne_candidat),
      patient_profile  = case
                           when patient_profile = '{}'::jsonb
                           then jsonb_build_object('role_brief', coalesce(brief_patient, ''))
                           else patient_profile
                         end,
      grading_grid     = case
                           when grading_grid = '{}'::jsonb
                           then jsonb_build_object('markdown', coalesce(grille_correction, ''))
                           else grading_grid
                         end;
  end if;
end $$;

-- 3) Retrait des colonnes françaises (données déjà migrées).
alter table public.ecos_cases
  drop column if exists titre,
  drop column if exists specialite,
  drop column if exists duree,
  drop column if exists consigne_candidat,
  drop column if exists brief_patient,
  drop column if exists grille_correction;

-- 4) Contraintes attendues par le code.
update public.ecos_cases set duration_minutes = 10 where duration_minutes is null;
alter table public.ecos_cases
  alter column title            set not null,
  alter column specialty        set not null,
  alter column brief            set not null,
  alter column duration_minutes set default 10;
