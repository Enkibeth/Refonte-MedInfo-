# CLAUDE.md — État IA / Supabase pour reprise par agents

```yaml
status: Active
date: 2026-06-06
owner: Hugo Bettembourg
scope: Documentation de reprise pour agents IA (Claude Code / Codex)
```

## Règles de reprise

1. Lire `START.md`, `.ai-governance.md`, `docs/01_REGULATION.md`, puis `docs/README.md` avant tout changement.
2. Ne jamais dégrader la safe-box non-MDSW : classifieur avant LLM principal, refus déterministe en cas de doute, RAG cite-or-refuse.
3. Ne pas implémenter d'historique patient, dossier, triage, diagnostic ou CAT individualisée sans ADR `Proposed` + arbitrage Hugo.
4. Une feature par branche dédiée ; documentation et ADR doivent accompagner chaque décision structurante.

## Tableau des features IA

| Feature | Statut | Surface / audience | Source de vérité | Sécurité / conformité | ADR |
|---|---|---|---|---|---|
| Chat information générale `public.v2` | Actif | Grand public | `src/ai/prompts/public.v2.ts`, orchestration API chat | Refus canonical pour symptômes personnels/urgence, disclosure AI Act, pas de donnée santé persistée | ADR-0003, ADR-0005 |
| Chat pédagogique `student.v2` | Actif | Étudiants vérifiés | `src/ai/prompts/student.v2.ts`, routing persona serveur | Cas fictifs EDN/R2C/ECOS autorisés ; patient réel refusé | ADR-0005, ADR-0011 |
| Classifieur étage 1 regex/lexique | Actif | Tous messages avant LLM | `src/ai/classifier/regexClassifier.ts`, `lexicon.ts` | Déterministe, prioritaire, court-circuite le LLM principal sur urgence/personnel | ADR-0003 |
| Classifieur étage 2 LLM léger | Actif conditionnel | Messages non tranchés par l'étage 1 | `src/ai/classifier/llmStage2.ts`, variables `CLASSIFIER_STAGE2_ENABLED` / `CLASSIFIER_MODEL_ID` | `temperature=0`, JSON typé, seuil 0,85, fail-closed vers `ambiguous` | ADR-0013, ADR-0015 |
| RAG HAS/ANSM MVP | Actif lexical, dense prêt | Public + étudiant | `rag_sources`, `rag_chunks`, `match_rag_chunks`, `src/rag/retrieval.ts` | Sources publiques whitelistées, métadonnées validées, source isolation anti prompt-injection | ADR-0014 |
| Embeddings RAG réels | Pipeline livré, peuplement à faire | Retrieval documentaire | `text-embedding-3-small`, `scripts/embeddings/ingest-corpus.mjs` | Zéro pseudo-embedding ; lexical-only si clé/réseau échoue ; EU residency/ZDR à activer avant prod | ADR-0014 |
| Vérification étudiant | Actif | Choix rôle étudiant | `profiles`, route `app/api/role+api.ts` | E-mail académique / statut serveur, anti-auto-promotion RLS | ADR-0011 |
| Vérification RPPS / ANS | Configurée côté décision, activation contrôlée | Professionnels de santé | API FHIR Annuaire Santé, statut `pending` tant que clé absente | RPPS = donnée personnelle publique ; pro routable mais features cliniques gelées | ADR-0007, ADR-0011 |
| Facturation Stripe | Actif web-first | Plans public + étudiant | `subscriptions`, `billing_events`, webhook Stripe | Paywall = volume/features uniquement ; ne gate jamais les sources | ADR-0012 |
| Quotas par feature | Décidé / à maintenir côté serveur | Chat, ECOS, exports, transcriptions | Tables de limites/compteurs techniques, entitlements serveur | Quota découplé des sources ; service_role only ; aucune auto-promotion client | ADR-0016 |
| Cas ECOS en base | Décidé / feature pédagogique | Étudiants vérifiés | Tables de cas/stations pédagogiques versionnées | Cas explicitement fictifs ; aucun patient réel ; séparation du chat médical | ADR-0017 |

## Migrations Supabase — état documentaire

| Migration | Objet | Données santé ? | Accès client | Notes |
|---|---|---:|---|---|
| `0001_profiles.sql` | Profils user, persona, statut de vérification | Non | Own-row RLS | Base du routing d'audience |
| `0002_ai_interactions.sql` | Audit technique IA | Non (contenu sensible interdit) | Service role only | Ne pas utiliser comme historique patient |
| `0003_harden_handle_new_user.sql` | Durcissement trigger/RPC auth | Non | N/A | Sécurité auth |
| `0004_usage_counters.sql` | Compteurs journaliers rate-limit | Non | Service role only | Compteurs techniques sans contenu de message |
| `0005_profile_verification.sql` | Verrous anti-auto-promotion persona/status | Non | Own-row + garde serveur | Student/pro pending/pro verified |
| `0006_rag_pgvector.sql` | Sources/chunks RAG + pgvector + RPC | Non | Lecture documentaire contrôlée | Corpus HAS/ANSM public |
| `0007_subscriptions.sql` | Abonnements Stripe | Non | Lecture own-row ; écriture service role | Source de vérité paywall |
| `0008_billing_events.sql` | Idempotence webhooks Stripe | Non | Service role only | Anti-rejeu / déduplication |
| `0009_rag_match_or_semantics.sql` | Match RAG lexical OR + fusion dense | Non | RPC documentaire | Active RRF si embedding fourni |
| `0010_db_hardening.sql` | Search path fonctions + policies profiles | Non | Inchangé | Durcissement advisors Supabase |
| `0011_ai_runtime_config.sql` | Configuration IA runtime (features, modèles, flags) | Non | Service role/admin only | Table de pilotage, jamais contrôlée par le client |
| `0012_rpps_verifications.sql` | Journal minimal de vérification RPPS | Non médical ; donnée perso publique | Service role only | Cache ANS court, pas de donnée patient |
| `0013_ecos_cases.sql` | Cas ECOS fictifs versionnés | Non si cas synthétiques uniquement | Lecture selon entitlement étudiant | Ne jamais importer de cas patient réel |
| `0014_feature_quotas.sql` | Quotas par feature et compteurs associés | Non | Service role only | Remplace la logique « quota chat unique » par une matrice extensible |

> Si une migration ci-dessus n'existe pas encore dans `supabase/migrations/`, la documenter comme décision attendue et ne pas modifier le schéma sans tests RLS correspondants.

## Points de vigilance

- Les features professionnelles cliniques restent gelées par ADR-0006 même si le RPPS devient vérifié.
- Les cas ECOS doivent rester des vignettes pédagogiques fictives ; un cas réel anonymisé reste refusé.
- Les quotas ne doivent jamais limiter l'accès aux sources de sécurité (HAS/ANSM) ni transformer une réponse refusée en réponse payante.
- Toute nouvelle table utilisateur : RLS active + test `tests/rls/` avant merge.
