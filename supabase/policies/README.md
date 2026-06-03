# Supabase RLS policies

Une table utilisateur = RLS active + test `tests/rls` (gate `rls-isolation`).

- `profiles.sql` — isolation own-row (`auth.uid() = id`), 4 policies SELECT/INSERT/UPDATE/DELETE.
- `ai_interactions.sql` — service_role only : RLS activée SANS policy + REVOKE client.
