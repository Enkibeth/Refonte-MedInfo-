# Supabase migrations

DDL versionné. Toute table utilisateur a une RLS active (voir `../policies/`) ET testée
(`tests/rls/`, gate `rls-isolation`).

- `0001_profiles.sql` — table user (persona + statut vérif). Aucune donnée de santé.
- `0002_ai_interactions.sql` — audit (03_SECURITY §6). Service role only.
- `0003_harden_handle_new_user.sql` — durcissement RPC handle_new_user.
- `0004_usage_counters.sql` — compteurs journaliers rate-limit user/persona ou IP hash/persona. Aucune donnée de santé.
