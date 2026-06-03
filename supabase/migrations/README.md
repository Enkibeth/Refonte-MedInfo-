# Supabase migrations

DDL versionné. Toute table utilisateur a une RLS active (voir `../policies/`) ET testée
(`tests/rls/`, gate `rls-isolation`).

- `0001_profiles.sql` — table user (persona + statut vérif). Aucune donnée de santé.
- `0002_ai_interactions.sql` — audit (03_SECURITY §6). Service role only.
