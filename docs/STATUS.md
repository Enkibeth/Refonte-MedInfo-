# MedInfo AI — Statut projet

```yaml
title: Project Status
version: 1.0.0
owner: Hugo Bettembourg
status: Active
date: 2026-06-04
```

## État courant

- Étapes 1 → 5 livrées côté repo. Corrections d'audit (B1/I1/I2/I3/M1), rate-limiting (M2),
  déploiement Vercel et RAG pgvector MVP HAS/ANSM intégrés.
- Branches `main`, `dev`, `staging` : **alignées** après PR #26 côté historique local.
  `dev` reste la branche d'intégration ; brancher les sessions depuis `dev`, puis feature branch `ai/<agent>/<feature>`.
- Architecture documentaire : organisée dans `docs/` avec ADRs dans `docs/DECISIONS/`.
- Workflow GitHub Actions : `.github/workflows/compliance.yml` (5 gates).

## Validations

Dernière validation locale étape 5 (2026-06-04) :

```bash
npm run typecheck                                            # OK
npm run test:unit                                           # OK
npm run test -- tests/rag/retrieval.test.ts tests/chat/chat-api-rate-limit.test.ts  # OK
npm run validate:prompts                                    # OK
npm run validate:rag                                        # OK
npm run compliance:grep                                     # OK
npm run test:prompt-regression                              # OK
npm run test / npm run compliance                           # OK après installation Postgres + pgvector local
```

Le blocage local précédent du gate RLS est résolu dans cet environnement par l'installation de
`postgresql` et `postgresql-16-pgvector`. Pour reproduire sur Ubuntu/Debian :
`sudo npm run setup:rls:ubuntu`. Sur un autre système, fournir `RLS_TEST_DATABASE_URL` ou
`DATABASE_URL` vers un Postgres disposant de l'extension `vector`.

## Statut CI distante

La chaîne CI distante (GitHub Actions `compliance`) est **active et verte** sur `dev`,
`staging` et `main` (runs `pull_request` + `push`). La réserve initiale (« aucun run
exploitable au moment du contrôle ») est **levée**.

## Corrections d'audit IA (2026-06-03)

Audit en lecture seule → corrections appliquées et mergées sur `dev` puis `main`/`staging` :

- **B1** — couche 3 (validation de sortie) désormais bufferisée et **remplaçante** avant émission.
- **I1** — couche 1 appliquée à **tout l'historique** (`screenConversation`), pas au seul dernier message.
- **I2** — refus déterministe émis en **flux UI-message** (s'affiche au lieu d'une erreur générique).
- **I3** — disclosure AI Act **multi-provider** (`getAiDisclosure`, reflète le modèle servi ; 01_REGULATION §6 v1.2.0).
- **M1** — `orchestrator.ts` devient le module d'accès pré-LLM (plus de code mort).
- **M2** — rate-limiting `POST /api/chat` (table `usage_counters`, limites MVP).
- Fix latent : état tool-part client `'output-available'` (les tool-calls ne s'affichaient pas).

Le classifieur couche 1 (lexique/regex) n'a pas été modifié. Suite : `npm run compliance` (5 gates) + 107 tests verts.

## Déploiement Vercel — fix 404 (2026-06-03)

Le site renvoyait 404. Causes : projet Vercel en Node 24.x (incompatible `@vercel/node`,
build en échec) + absence de `dist/client/index.html` en `web.output=server`. Corrigé par
`engines.node = "22.x"` (package.json) + script de fallback HTML (`scripts/vercel/`). Déploiement
validé READY. **À faire côté Vercel** : variables d'env Supabase/LLM (cf `docs/09_DEPLOYMENT.md`).


## Étape 5 — RAG pgvector HAS/ANSM : **implémentée MVP (TDD)**

Critère minimal START.md — **atteint côté repo/test local** : une question générale couverte
par le corpus renvoie une citation HAS réelle (`has-sante.fr`) via `retrieveLocalRagChunks`.

Périmètre livré :

- Migration `0006_rag_pgvector.sql` : extension pgvector, tables `rag_sources` / `rag_chunks`,
  index HNSW + GIN français, fonction RPC `match_rag_chunks` avec fusion lexical/vectorielle
  et seed minimal HAS/ANSM.
- Corpus MVP officiel : HAS diabète de type 2 2025, HAS surpoids/obésité adulte 2023, ANSM
  bon usage AINS. Métadonnées obligatoires : source HTTPS, licence, date, section, EDN, hash.
- Retrieval `src/rag/retrieval.ts` : Supabase RPC si configuré, fallback local lexical verrouillé dev/test,
  section de prompt RAG et refus cite-or-refuse.
- `/api/chat` : après couche 1 et uniquement pour `general_info`, récupération RAG avant LLM ; si
  aucun chunk validé ne couvre la question, réponse déterministe « Les sources disponibles ne
  permettent pas de répondre avec certitude. » et LLM principal non appelé.
- Gate `npm run validate:rag` devenu effectif : valide le corpus au lieu de retourner un OK scaffold.

Limites assumées : embeddings production et ingestion PDF/OCR large non encore livrés ; aucune pseudo-embedding n'est envoyée ; le MVP
prépare pgvector et valide le contrat réglementaire/technique sur petit corpus.

## Étape 2 — classifieur d'intention : **implémentée (couche 1)**

Réalisée en TDD (tests de refus écrits avant la logique).

Critère minimal de validation — **atteint** :

```txt
"j'ai mal au ventre" → refus canonique `01_REGULATION.md §4`   ✅
LLM principal non appelé (garanti par runClassifierGate)       ✅
Tests de refus verts                                           ✅
```

Périmètre livré :

- Étage 1 regex déterministe local (`src/ai/classifier/`) : 5 catégories
  `general_info` / `personal_symptoms` / `emergency` / `out_of_scope` / `ambiguous`.
- Refus canonique (source unique `src/compliance/disclosures.ts`) pour
  `personal_symptoms` / `emergency` / `ambiguous`. `general_info` seul → LLM principal.
- Étage 2 (LLM léger) : interface injectable **non câblée** à cette étape (fail-safe `ambiguous`).
- Ceinture + bretelles : un verdict `general_info` de l'étage 2 est rétrogradé si un
  marqueur personnel regex subsiste.

Validations locales : `npm run typecheck`, `npm run test`, `npm run compliance`
(5 gates) → **OK**.

### Golden set FR + calibration (Codex + Claude)

Golden set de 500 exemples (`tests/classifier/golden/golden-set.fr.jsonl`, produit par Codex)
+ harnais d'éval (`scripts/eval/classifier-goldenset.mjs`, `npm run eval:classifier`, **hors**
chaîne `compliance`). Audit : distribution 35/30/20/10/5 % conforme §5, 30 % adversariaux,
0 PII (dette qualité : 56 doublons exacts à diversifier).

Calibration du lexique (couche 1, regex seul, sans étage 2) :

| Classe | Recall | Précision | Cible §6 |
|---|---|---|---|
| emergency | **100 %** | 100 % | recall ≥99 % ✅ |
| personal_symptoms | **100 %** | 98 % | recall ≥97 % ✅ |
| general_info | 28,6 % | 90,9 % | précision ≥95 % ⚠️ |

**0 fuite vers le LLM principal** (aucun cas `emergency`/`personal_symptoms` routé `general_info`).
La précision `general_info` < 95 % et le faible recall `general_info`/`out_of_scope` sont une
limite **assumée du regex seul** : séparer « explique la différence entre un ETF » (non médical)
de « explique la différence entre angine et pharyngite » (médical) relève de l'**étage 2 (LLM
sémantique)**, reporté. `eval:classifier` sort donc en exit 1 sur la cible `general_info`
précision — informatif, non bloquant (hors `compliance`).

## Étape 3 — Auth Supabase + routing persona + RLS testées : **implémentée (TDD)**

Tests d'isolation RLS écrits AVANT les policies (rouge → vert).

Critères de validation START.md — **atteints** :

```txt
Login Supabase (magic link OTP, ADR-0007)                                  ✅ câblé
Routing par persona : public + student actifs                              ✅
  professional routable mais enabledInMvp=false (ADR-0006), 0 surface UI    ✅
RLS cross-user : user A lit/écrit la ligne de user B → ÉCHOUE              ✅ (gate rls-isolation)
ai_interactions service_role only, jamais accessible au client            ✅ testé
```

Périmètre livré :

- `supabase/migrations/` : `profiles` (RLS own-row, trigger handle_new_user, zéro donnée santé)
  et `ai_interactions` (audit §6, RLS activée SANS policy → client refusé).
- `supabase/policies/` : `profiles.sql` (4 policies auth.uid()=id) + `ai_interactions.sql`
  (REVOKE client, service_role only).
- `tests/rls/isolation.test.ts` (9 tests) sur **vrai Postgres** via harness éphémère
  (`tests/rls/helpers/`, ADR-0009) — le gate `rls-isolation` est désormais RÉELLEMENT actif.
- `src/ai/routing/persona.ts` + test unitaire ; `src/auth/AuthProvider.tsx` ; garde de
  navigation par persona dans `app/_layout.tsx` ; écrans `sign-in` / `account` minimaux
  fonctionnels (UI polie déléguée à Codex).

Validations locales : `npm run typecheck`, `npm run test` (67 tests), `npm run compliance`
(5 gates, dont `rls-isolation` réel) → **OK**.

Hors périmètre conservé (étapes ultérieures) : chat streaming, RAG, Stripe, historique/dossiers,
étage 2 du classifieur. Le classifieur couche 1 n'a pas été modifié.

## Étape 4 — Chat streaming + prompt public.v2 + 4 outils : **implémentée + réintégrée sur dev**

Chat streaming (Vercel AI SDK v6), prompt `public.v2` (versionné sous contrat, gate
`prompt-contract` vert), 4 skills (`propose_followups`, `show_sources`, `refuse_and_redirect`,
`render_qcm` student-only), couche 3 `outputValidator` (marqueurs diagnostiques bloqués).

**Note topologie** : l'étape 4 avait d'abord été mergée dans `main` sur une base antérieure à
l'étape 3 (recréant un `useSession` parallèle via `user_metadata`). Réintégrée sur `dev`
par-dessus l'étape 3 : le chat lit la persona via l'`AuthProvider` adossé à la RLS (`profiles`),
doublon `src/hooks/useSession.ts` supprimé. `dev` porte désormais les étapes 2 + 3 + 4.
`main` et `staging` ont été réalignés sur `dev` (PR #17/#18).

Validations : `npm run typecheck` ✅ · `npm run test` (88) ✅ · `npm run compliance` (5 gates) ✅.

## Étape suivante

Étape 5 — RAG pgvector sur petit corpus test HAS/ANSM (`08_RAG`).
Pré-requis classifieur restants (post-MVP) : câblage étage 2 (Gemini Flash-Lite / Haiku 4.5),
persistance `classifier_decisions`, diversification du golden set, lexique `out_of_scope`.

⚠️ **Hygiène branches** : faire brancher les prochaines sessions (Claude/Codex) depuis `dev`,
jamais `main`. Envisager de définir `dev` comme branche par défaut du repo pour éviter les
réintégrations (cf incidents étape 4 mergée sur main, Codex #4 ciblant main).

## Déploiement Vercel + Supabase dédié — **configuré côté repo**

Périmètre livré le 2026-06-03 :

- Export Expo Router passé en `web.output=server` pour générer `dist/client` + `dist/server`.
- Entrypoint Vercel `api/index.js` avec `expo-server/adapter/vercel`.
- `vercel.json` v3 : build `expo export -p web`, output `dist/client`, inclusion `dist/server/**`, rewrite vers la Function.
- Helper serveur Supabase centralisé (`src/db/serverSupabase.ts`) : `SUPABASE_URL` prioritaire, fallback `EXPO_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` serveur uniquement.
- Route smoke-test `GET /api/health` sans secret pour confirmer provider IA + statut Supabase.
- Runbook complet dans `docs/09_DEPLOYMENT.md`.

Limite : les vraies clés Supabase/IA ne sont pas présentes dans le repo et doivent être ajoutées dans Vercel. La connexion au projet Supabase dédié sera effective après création des variables `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` dans Vercel et redéploiement.
