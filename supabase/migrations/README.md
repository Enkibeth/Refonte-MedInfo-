# Supabase migrations

DDL versionné. Toute table utilisateur a une RLS active (voir `../policies/`) ET testée
(`tests/rls/`, gate `rls-isolation`). Les migrations techniques ne doivent jamais stocker de contenu
médical individualisé ni devenir un historique patient.

## Migrations présentes dans le repo

- `0001_profiles.sql` — table user (persona + statut vérif). Aucune donnée de santé.
- `0002_ai_interactions.sql` — audit technique IA (03_SECURITY §6). Service role only.
- `0003_harden_handle_new_user.sql` — durcissement RPC/trigger `handle_new_user`.
- `0004_usage_counters.sql` — compteurs journaliers rate-limit user/persona ou IP hash/persona. Aucune donnée de santé.
- `0005_profile_verification.sql` — verrouillage auto-promotion persona/status, vérification student/professional.
- `0006_rag_pgvector.sql` — tables documentaires RAG HAS/ANSM, pgvector, RPC retrieval, seed MVP. Aucune donnée utilisateur.
- `0007_subscriptions.sql` — abonnements Stripe, lecture own-row, écriture service role. Aucune donnée de santé.
- `0008_billing_events.sql` — idempotence webhook Stripe, service role only.
- `0009_rag_match_or_semantics.sql` — RPC `match_rag_chunks` en sémantique OR + fusion lexical/dense RRF si embedding fourni.
- `0010_db_hardening.sql` — `search_path` figé sur fonctions et optimisation policies `profiles`.
- `0011_ai_model_config.sql` — config admin du modèle par feature IA (`key, model_id, provider, label`). Service role only, RLS sans policy client. **Seed des 6 features** (le POST admin fait un UPDATE, les lignes doivent préexister). Lue par `featureModel.ts` + `app/api/admin/config+api.ts`.
- `0012_ai_prompts.sql` — overrides admin des system prompts (`key, label, template, scope, version`). Service role only, RLS sans policy client. Pas de seed (fallback `PROMPT_DEFAULTS`, upsert au save). Lue par `promptStore.ts` + panel admin.

## Migrations structurantes documentées pour la suite

Ces objets sont décidés/documentés pour refléter l'état cible de la session, mais tout ajout SQL doit
rester accompagné de policies et tests RLS dédiés avant merge.

- `0013_ecos_cases.sql` — cas/stations ECOS fictifs et versionnés. Lecture selon audience/entitlement étudiant ; interdiction d'importer un cas patient réel. *(branche `zealous-mendel`, à intégrer par une session CC dédiée.)*
- `0014_entitlements.sql` — quotas par feature (`chat`, `ecos`, `transcription`, `export`) et compteurs techniques associés. Service role only, aucune source HAS/ANSM paywallée. *(branche `gracious-brown`, à intégrer par une session CC dédiée.)*
- RPPS / Annuaire Santé FHIR — vérification professionnelle réelle (statut `pending` sans clé ANS). *(branche `determined-ride`, à intégrer par une session CC dédiée.)*

## Invariants

- RLS active sur toute table exposable ; écriture client interdite sauf own-row explicitement testée.
- Les tables de configuration, quotas, facturation et audit sont des tables **techniques** : pas de prompt complet, pas de symptôme personnel, pas de dossier patient.
- Un rôle professionnel vérifié ne débloque pas les features cliniques pro tant qu'ADR-0006 n'est pas levée.
