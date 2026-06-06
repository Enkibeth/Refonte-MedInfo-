-- Seed dev : état technique de rate-limit pour vérifier les personas sans contenu médical.
-- Ces lignes sont des compteurs/configurations de développement, pas des traces de conversation.

insert into public.usage_counters (
  counter_key,
  identity_type,
  user_id,
  ip_hash,
  persona,
  window_date,
  daily_count,
  last_increment_at,
  created_at,
  updated_at
)
values
  (
    'chat:dev-public',
    'user',
    '00000000-0000-4000-8000-000000000101',
    null,
    'public',
    current_date,
    0,
    now(),
    now(),
    now()
  ),
  (
    'chat:dev-student',
    'user',
    '00000000-0000-4000-8000-000000000102',
    null,
    'student',
    current_date,
    0,
    now(),
    now(),
    now()
  ),
  (
    'chat:dev-professional',
    'user',
    '00000000-0000-4000-8000-000000000103',
    null,
    'professional',
    current_date,
    0,
    now(),
    now(),
    now()
  )
on conflict (counter_key, persona, window_date) do update set
  identity_type = excluded.identity_type,
  user_id = excluded.user_id,
  ip_hash = excluded.ip_hash,
  daily_count = excluded.daily_count,
  last_increment_at = excluded.last_increment_at,
  updated_at = now();
