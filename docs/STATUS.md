# MedInfo AI — Statut projet

```yaml
title: Project Status
version: 1.1.0
owner: Hugo Bettembourg
status: Active
date: 2026-06-06
```

## État courant — 2026-06-07

- **Réconciliation `main` ↔ `dev`** : merge de `origin/dev` (refonte design #59 + fix CI #62) dans la
  branche de session, qui contenait déjà le branding `main` (#60/#61). Conflits limités à `app/index.tsx`
  et `src/ui/primitives/Logo.tsx`, résolus en faveur de `dev` (Logo wordmark code `size`+`tone`, hero design system) ;
  branding des écrans Compte/Tarifs/Légal/Chat + assets conservés. Typecheck vert.
- **Visibilité des outils par rôle (grosse modif)** : matrice stricte par persona
  (`src/ai/routing/featureVisibility.ts`) — grand public : Chat + Document ; étudiant : Chat + ECOS +
  Analyseur de partiel ; pro : Chat + Audio ; admin : tout. Appliquée aux onglets (`href: null`), aux
  écrans (`RoleGate`) et à l'écran Compte (« Mes outils »). ADR-0018.
- **Analyseur de partiel** (`partiel_analyze`, route `/api/partiel`, écran `app/(chat)/partiel.tsx`) :
  outil étudiant qui analyse des résultats de QCM/partiels (items EDN faibles + plan de révision),
  éducatif/non-MDSW, garde persona serveur. Convention 6 étapes + migration `0017`. ADR-0019.
- **Validations locales** : `typecheck` OK · `npm run test` **268 verts** (40 fichiers, dont RLS réel
  avec Postgres+pgvector ; seed `ai_model_config` 6→7) · `npm run compliance` (5 gates) OK ·
  `compliance:grep` / `validate:prompts` / `validate:rag` OK.
- Stratégie Git : développement sur la branche de session → **PR vers `main`** (alignement validé par Hugo).
- Roadmap visuelle/produit : `docs/GLOWUP_ROADMAP.md` (créée/mise à jour).

### Itération 2 (même jour) — dictée, menu d'outils, correction partiel, nettoyage PR

- **Dictée vocale** dans les saisies chat + ECOS (`src/ui/components/DictationButton.tsx`) : voix → texte via
  Whisper (`/api/transcribe`, nouveau mode `raw` sans diarisation). Le texte repasse par la safe-box.
- **Menu déroulant d'outils** (`src/ui/components/ToolsMenu.tsx`) dans les en-têtes (chat/document/audio) : switch
  rôle-aware bien visible, complète la barre d'onglets du bas.
- **Analyseur de « partiel » corrigé** : la 1re version (coach de révision LLM) était erronée. La vraie
  feature (medoutils) est un **analyseur de classement de promo** (import des notes → rang + comparaison),
  prévu **côté client sans IA**. La version LLM est **retirée** (route `/api/partiel`, prompt, migration
  `0017`, feature admin `partiel_analyze`) ; onglet `Classement` = placeholder en attente de la spéc. ADR-0019.
- **Fixes ré-intégrés** : garde clé Supabase corrompue/Latin-1 (`src/db/supabase.ts`, ex-PR #44) ;
  suppression des warnings npm du build Vercel (`.npmrc` legacy-peer-deps + override `uuid@^11`, ex-PR #45).
- **Nettoyage PR (reparte de 0)** : #63 mergé sur `main`, `dev`/`staging` réalignés, et les 8 autres PR
  fermées (obsolètes/divergentes ou ré-intégrées). Plus rien en attente.
- Validations : `typecheck` OK · `npm test` **268 verts** · seed `ai_model_config` de retour à **6**.

### Itération 3 (même jour) — Analyseur de classement (v1)

- Après fouille exhaustive du repo medoutils (`Enkibeth/QCM-quizz`, toutes branches) : la feature
  « classement » **n'y existe pas** (repo = PDF→QCM/QROC + ECOS). Construite depuis la description de Hugo.
- **Analyseur de classement v1** (`app/(chat)/partiel.tsx` + logique pure `src/lib/classement.ts`,
  testée) : import CSV/TSV (upload web ou collage) → rang, moyenne/médiane/min/max, % en-dessous,
  comparaison par n° étudiant. **100 % côté client** (aucune donnée envoyée, sans IA). Pas de dépendance
  `xlsx` (version npm vulnérable high-severity) → Excel à exporter en CSV. `npm test` **278 verts**.

## État courant — 2026-06-06

- Documentation de reprise ajoutée dans `CLAUDE.md` : tableau des features IA et table des migrations Supabase existantes/attendues.
- Safe-box IA : classifieur étage 1 regex toujours prioritaire ; étage 2 LLM léger accepté comme routeur sémantique fail-closed (ADR-0013 + ADR-0015).
- Configuration IA runtime : trajectoire documentée pour centraliser les flags/modèles/features côté serveur, sans contrôle client.
- RPPS : vérification ANS/FHIR reste contrôlée serveur ; en absence de clé `ANNUAIRE_SANTE_API_KEY`, le statut professionnel reste `pending` et les features cliniques pro restent gelées.
- ECOS : cas pédagogiques à stocker en DB comme contenus synthétiques/versionnés, jamais comme cas patient réel (ADR-0017).
- Quotas : décision de passer à une matrice par feature (`chat`, `ecos`, `transcription`, `export`) ; paywall toujours limité au volume/features avancées, jamais aux sources HAS/ANSM (ADR-0016).
- ADRs actées : 0015 (runtime classifieur étage 2), 0016 (quotas par feature), 0017 (cas ECOS en DB).

## Validations documentation — 2026-06-06

```bash
git diff --check                 # OK
```

Aucune modification de code ou de schéma SQL dans cette passe ; pas de test applicatif relancé.

## État courant

- Étapes 1 → 6 livrées côté repo. Corrections d'audit (B1/I1/I2/I3/M1), rate-limiting (M2),
  déploiement Vercel, RAG pgvector MVP HAS/ANSM, persona étudiant `student.v2` et fix
  de renvoi d'email de confirmation intégrés.
- `dev` contient les PR #28, #30, #31 et #32 au-dessus de `main` (`aae2c2d`).
  Cette branche d'alignement fusionne `origin/dev` (`d87aa74`, PR #32) vers `main`, afin que
  `main` récupère aussi les changements jusqu'à la PR #32.
- `staging` reste à réaligner séparément après merge de `main` si l'objectif est une parité
  stricte `main`/`dev`/`staging`. `dev` reste la branche d'intégration ; brancher les sessions
  depuis `dev`, puis feature branch `ai/<agent>/<feature>`.
- Architecture documentaire : organisée dans `docs/` avec ADRs dans `docs/DECISIONS/`.
- Workflow GitHub Actions : `.github/workflows/compliance.yml` (5 gates).

## Alignement main ← dev (2026-06-04)

Demande traitée : intégrer sur `main` les nouvelles branches/PR présentes sur `dev` jusqu'à la
PR #32. État distant vérifié par `git fetch origin` :

- `origin/main` : `aae2c2d` — dernier alignement PR #26.
- `origin/dev` : `d87aa74` — merge PR #32, avec PR #28, #30 et #31 également absentes de `main`.
- `origin/staging` : `d9ca851` — encore au jalon PR #27, donc non alignée sur le `dev` actuel.

Cette PR doit être mergée vers `main` pour porter `main` au niveau de `dev`/PR #32. Ensuite, si
nécessaire, ouvrir un alignement `staging` depuis `main` ou `dev`.

## Validations

Dernière validation locale étape 6 (2026-06-04) :

```bash
npm run typecheck                 # OK
npm run test                      # OK (128 tests)
npm run validate:prompts          # OK (2 artefacts)
npm run validate:rag              # OK (4 chunks RAG)
npm run compliance                # OK (5 gates, RLS avec Postgres + pgvector local)
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


## Étape 7 — Facturation Stripe web-first (freemium tiered) : **implémentée (TDD, ADR-0012)**

Feature unique du bloc (START.md règle 3) : monétisation **freemium tiered** public + étudiant,
**Stripe direct web-first, zéro IAP** (06_BILLING §1/§3/§4/§6). Branchée depuis le contenu de `dev`
(arbre identique à `main`), feature branch de session. Aucun push main/dev/staging.

Critères « terminé » START.md — **atteints côté repo/test local** :

```bash
npm run typecheck     # OK
npm run test          # OK (194 tests, +23 vs étape 6)
npm run compliance    # OK (5 gates ; rls-isolation 23 tests, dont billing-isolation)
```

Périmètre livré :

- Migrations `0007_subscriptions.sql` (RLS lecture own-row, écriture service_role) + `0008_billing_events.sql`
  (idempotence, service_role only). **Zéro donnée de santé** ; e-mail non dupliqué (reste dans `auth.users`).
- `src/billing/` : `plans` (public + étudiant ; **aucun plan pro**, gelé ADR-0006), `entitlements`
  (quota uniquement, **aucun gating de sources** — invariant testé), `stripeSignature` (HMAC maison
  timing-safe + anti-rejeu), `webhookHandler` (idempotent, mapping statuts), `createCheckoutSession`
  (REST Stripe via `fetch`, no-SDK), `surface` (web-first/zéro IAP).
- Routes : `POST /api/billing/checkout` (identité dérivée du token, audience gating, ne gate aucune
  source) ; `POST /api/stripe/webhook` (signature vérifiée, idempotent, upsert service_role —
  **seule source de vérité** du statut payant).
- Rate-limit : abonné actif → quota illimité (volume seul ; sources jamais concernées, 06_BILLING §5).
- UI : écran `(billing)/pricing` web-only (bandeau « sources gratuites pour tous », mention TVA
  293 B CGI, aucun prix/bouton sur natif) ; encart abonnement dans `(account)/account`.
- Tests : RLS d'isolation + anti-auto-promotion (vrai Postgres) ; signature ; webhook idempotent ;
  entitlements (anti-gating sources) ; checkout (rejet plan pro) ; surface (zéro IAP).

Garde-fous respectés : safe-box 3 couches + classifieur couche 1 **inchangés** ; pas d'historique /
dossiers / persistance de message (donnée santé → HDS, hors périmètre) ; secrets hors repo
(`.env.example` + `docs/09_DEPLOYMENT.md`, à poser dans Vercel — action Hugo).

Limites assumées : pricing/portail Stripe minimalistes ; `current_period_end` exact alimenté par
`customer.subscription.updated` ; pas de Customer Portal Stripe (lien de gestion) au MVP.

## Étape 6 — Prompt student.v2 + QCM + toggle sources : **implémentée (TDD)**

Critères START.md — **atteints côté repo/test local** : persona `student` actif dans
`/api/chat`, prompt `student.v2` sous contrat, `render_qcm` exposé uniquement aux étudiants,
panneau/toggle sources haut de chat alimenté par `show_sources`, et RAG cite-or-refuse conservé.

Périmètre livré :

- Prompt `src/ai/prompts/student.v2.ts` conforme `docs/04_CHATBOT.md §6` : éducatif non-MDSW,
  cas cliniques acceptés uniquement s'ils sont explicitement fictifs/pédagogiques, refus déterministe
  pour patient réel/personnel, anti-hallucination et RAG cite-or-refuse.
- `/api/chat` : `VALID_PERSONAS = public | student`; matrice tools explicite : public sans
  `render_qcm`, student avec `propose_followups`, `show_sources`, `refuse_and_redirect`,
  `render_qcm`. `professional` reste hors route MVP.
- Couche 1 : exception étroite `allowFictiveEducationalCases` uniquement appelée par la route
  `student`; les cas réels/anonymisés/stage/proche restent bloqués avant LLM.
- UI chat : rendu interactif minimal du tool `render_qcm` et bouton d'en-tête « Sources (n) »
  basculant vers le panneau de sources de la réponse courante ; le panneau inline historique reste
  disponible.
- Tests ajoutés : contrat prompt student, matrice tools, cas fictif vs cas réel, helper UI sources,
  non-régression RAG cite-or-refuse student.

Limites assumées : le rendu QCM est minimal (sélection/réponse/explication) et ne persiste aucun
résultat ; les citations EDN pages/rangs restent dépendantes du corpus futur. Aucune donnée de santé
identifiable n'est stockée.

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

Limites assumées : le **pipeline d'embeddings réels** est désormais livré (CC-03, section dédiée,
ADR-0014), mais le **peuplement des vecteurs** et l'**ingestion PDF/OCR large** restent en attente de
l'ouverture de l'allowlist réseau ; aucune pseudo-embedding n'est jamais envoyée ; le MVP prépare
pgvector et valide le contrat réglementaire/technique sur petit corpus.

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
chaîne `compliance`). Audit initial : distribution 35/30/20/10/5 % conforme §5, 30 % adversariaux,
0 PII. Hygiène dataset (2026-06-06) : 56 doublons exacts supprimés, 56 exemples
FR diversifiés ajoutés sans changer le schéma JSONL ni les labels des exemples conservés.
Distribution après déduplication : `general_info` 175, `personal_symptoms` 144, `emergency` 100,
`out_of_scope` 40, `ambiguous` 41 ; 0 doublon exact restant (`npm run eval:classifier` OK).

Calibration du lexique (couche 1, regex seul, sans étage 2) :

| Classe | Recall | Précision | Cible §6 |
|---|---|---|---|
| emergency | **100 %** | 100 % | recall ≥99 % ✅ |
| personal_symptoms | **100 %** | 98 % | recall ≥97 % ✅ |
| general_info | 28,6 % | 96,2 % | précision ≥95 % ✅ |

**0 fuite vers le LLM principal** (aucun cas `emergency`/`personal_symptoms` routé `general_info`).
Le faible recall `general_info`/`out_of_scope` reste une limite **assumée du regex seul** :
séparer « explique la différence entre un ETF » (non médical) de « explique la différence entre
angine et pharyngite » (médical) relève de l'**étage 2 (LLM sémantique)**. Après hygiène du
golden set (2026-06-06), les cibles bloquantes `eval:classifier` passent en local ; le harnais
reste informatif et hors `compliance`.

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

## Couche 2 classifieur + pages légales (2026-06-05) : **implémentées (TDD)**

- **Étage 2 du classifieur câblé** avec **Claude Haiku 4.5** (ADR-0013) — modèle Claude le moins cher/rapide,
  réutilise `ANTHROPIC_API_KEY`, aucun nouveau sous-traitant. `src/ai/classifier/llmStage2.ts`
  (`generateObject` + Zod, `temperature=0`, fail-closed), branché dans `app/api/chat+api.ts` de façon
  conditionnelle (`CLASSIFIER_STAGE2_ENABLED`). Étage 1 regex inchangé et prioritaire ; garde-fous
  (rétrogradation marqueur personnel + seuil 0,85) conservés. Gemini Flash-Lite reste activable via
  `CLASSIFIER_MODEL_ID` sans changement de code.
- **Pages légales** publiques ajoutées : mentions légales (LCEN), politique de confidentialité (RGPD),
  CGU/CGV. Contenu dans `src/compliance/legal.ts` (source unique, réutilise INTENDED_PURPOSE /
  getAiDisclosure / CANONICAL_REFUSAL), rendu par `src/ui/components/LegalScreen.tsx`, routes `app/(legal)/`,
  liens en pied de page (accueil + compte). Champs propres à l'éditeur en placeholder « [À COMPLÉTER] »
  (action Hugo : raison sociale, SIREN, adresse, directeur de publication, e-mail DPO).
- Validations locales : `npm run typecheck` OK · tests hors-RLS **189 verts** (+18) · `compliance:grep`,
  `validate:prompts`, `validate:rag` OK. (RLS : inchangées, exécutées en CI.)

## CC-03 — RAG embeddings réels (pipeline) + mesure recall (2026-06-05) : **pipeline livré, peuplement en attente d'allowlist**

- **Modèle décidé** (ADR-0014) : OpenAI `text-embedding-3-small` (1536 dims) — tient dans
  `rag_chunks.embedding vector(1536)` (aucun `ALTER`), réutilise `OPENAI_API_KEY` / `@ai-sdk/openai`
  (zéro nouvelle dépendance). Benchmark voyage/BGE et alternative souveraine Mistral reportés.
- **Pipeline livré (Lot A)** : `src/rag/embeddings.ts` (`embedText`/`embedMany`, garde de dimension,
  **zéro pseudo-embedding** — clé absente → throw) ; `src/rag/retrieval.ts` envoie un vrai vecteur de
  requête à `match_rag_chunks` (active la fusion lexical+dense RRF k=60 déjà en base) avec
  **dégradation lexical-only** propre si l'embedding échoue ; `scripts/embeddings/ingest-corpus.mjs`
  (`npm run rag:ingest`, idempotent `chunk_id`+hash, service-role, `--dry-run`). INV-B
  (`buildRagSystemSection` + `sanitizeSourceContent`) **non régressé**.
- **Mesure (Lot C)** : harnais `scripts/eval/rag-recall.mjs` (`npm run rag:recall`, modes
  lexical|fused) + jeu FR `tests/rag/recall-questions.fr.json`. **Baseline lexical live** (Supabase
  MCP) sur 10 questions in-corpus : recall@1/@3 chunk & doc = **100 %** — *non informatif* (corpus
  4 chunks : le lexical sature ; le gain du dense ne se mesure que sur corpus élargi, Lot B). 2
  questions hors corpus → **0 source → cite-or-refuse** OK.
- Gate `rag-license` **étendu à tous les `src/rag/corpus/*.json`** (un nouveau fichier ne peut plus
  échapper à la validation). Tests CI-safe ajoutés (`tests/rag/embeddings.test.ts`,
  `tests/rag/retrieval-embedding.test.ts`, mocks → aucun réseau).
- Validations locales : `typecheck` OK · tests hors-RLS **210 verts** (+21) · `compliance:grep`,
  `validate:prompts`, `validate:rag` OK · `rag:ingest --dry-run` OK. (RLS inchangées, exécutées en CI.)
- **Différé (bloqué réseau)** : l'allowlist de l'environnement bloque `api.openai.com` et
  `has-sante.fr`/`ansm.sante.fr` (HTTP 403 `host_not_allowed`). Donc **embeddings non encore peuplés**,
  recall **dense** non mesuré, et **élargissement du corpus (Lot B)** non fait (aucun contenu inventé).
  À la réouverture : `npm run rag:ingest` puis `npm run rag:recall -- --mode=fused`.
- **Action Hugo (hors code)** : activer EU Data Residency + Zero Data Retention + DPA/SCC Module 2 sur
  le projet OpenAI **avant ingestion de production** (01_REGULATION §5).

## Étape suivante

Étape 7 (Stripe billing web-first) **livrée** (ADR-0012). Features isolées restantes selon START.md :
export PDF, vérification statut pro (post-ADR-0006). **Historique / dossiers : NE PAS implémenter**
sans ADR « Proposed » + arbitrage Hugo (donnée de santé attribuable → HDS, 01_REGULATION §5).
Pré-requis classifieur restants (post-MVP) : ~~câblage étage 2~~ **fait (ADR-0013)** ; persistance
`classifier_decisions`, ~~diversification du golden set~~ **faite (0 doublon exact, 2026-06-06)**,
lexique `out_of_scope`. Pages légales : remplir
les champs éditeur « [À COMPLÉTER] » avant ouverture au public.

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
