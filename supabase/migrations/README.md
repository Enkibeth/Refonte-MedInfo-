# Supabase migrations

DDL versionné. Toute table utilisateur a une RLS active (voir `../policies/`) ET testée
(`tests/rls/`, gate `rls-isolation`).

- `0001_profiles.sql` — table user (persona + statut vérif). Aucune donnée de santé.
- `0002_ai_interactions.sql` — audit (03_SECURITY §6). Service role only.
- `0003_harden_handle_new_user.sql` — durcissement RPC handle_new_user.
- `0004_usage_counters.sql` — compteurs journaliers rate-limit user/persona ou IP hash/persona. Aucune donnée de santé.
- `0005_profile_verification.sql` — verrouillage auto-promotion persona/status, vérification student/professional.
- `0006_rag_pgvector.sql` — tables documentaires RAG HAS/ANSM, pgvector, RPC retrieval, seed MVP. Aucune donnée utilisateur.
- `0013_ecos_cases.sql` — banque de cas ECOS (contenu pédagogique fictif). Lecture publique des cas publiés (RLS inline, comme rag_*), écriture service_role. CRUD admin `/api/admin/ecos-cases`, corpus `data/ecos-cases.json` (seed `scripts/seed-ecos-cases.mjs`). Test `tests/rls/ecos-cases.test.ts`.
