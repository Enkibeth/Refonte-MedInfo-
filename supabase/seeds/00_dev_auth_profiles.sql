-- Seed dev : comptes et profils de test non identifiants.
-- Usage local uniquement. Mots de passe déterministes : DevMedInfo2026!
-- Aucune donnée de santé, aucun cas patient réel.

create extension if not exists pgcrypto;

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data
)
values
  (
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'dev-public@medinfo.local',
    crypt('DevMedInfo2026!', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"seed":"dev","persona":"public"}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'dev-student@medinfo.local',
    crypt('DevMedInfo2026!', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"seed":"dev","persona":"student"}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000103',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'dev-professional@medinfo.local',
    crypt('DevMedInfo2026!', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"seed":"dev","persona":"professional"}'::jsonb
  )
on conflict (id) do update set
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at,
  updated_at = now(),
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data;

insert into public.profiles (
  id,
  persona,
  status,
  verification_method,
  verified_at,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-4000-8000-000000000101',
    'public',
    'unverified',
    'none',
    null,
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000102',
    'student',
    'verified',
    'dev_seed_student_email',
    now(),
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000103',
    'professional',
    'verified',
    'dev_seed_professional_rpps_stub',
    now(),
    now(),
    now()
  )
on conflict (id) do update set
  persona = excluded.persona,
  status = excluded.status,
  verification_method = excluded.verification_method,
  verified_at = excluded.verified_at,
  updated_at = now();
