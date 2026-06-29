-- GRANTs revision_plans (ADR-0027) — own-row RLS définie dans 0027_student_revision.sql.
-- Rejoué par le harness RLS (tests/rls/helpers/pgHarness.ts) après les migrations.
-- Lecture/écriture réservées au rôle `authenticated` ; la RLS own-row fait le cloisonnement.
grant select, insert, update, delete on public.revision_plans to authenticated;
