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
| Analyseur de classement (medoutils) | Actif (v1) | Étudiants vérifiés | `app/(chat)/partiel.tsx`, logique pure `src/lib/classement.ts` | Import CSV/TSV des notes de promo (upload web ou collage) → rang, stats, comparaison par n° étudiant ; calcul 100% client (aucune donnée envoyée, sans IA) | ADR-0019 |
| Visibilité des outils par rôle + menu d'outils | Actif | Tous (UI adaptée) | `src/ai/routing/featureVisibility.ts`, `src/ui/RoleGate.tsx`, `src/ui/ToolsMenu.tsx`, `app/(chat)/_layout.tsx` | Cloisonnement UI strict par persona ; menu déroulant rôle-aware ; jamais l'unique barrière (autorisation serveur conservée) | ADR-0018 |
| Dictée vocale (chat/ECOS) | Actif | Tous | `src/ui/DictationButton.tsx`, `/api/transcribe` mode `raw` | Voix → texte (Whisper) dans les saisies ; transcription brute ; le texte repasse par la safe-box de la route cible | ADR-0019 |

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
| `0011_ai_model_config.sql` | Config admin du modèle par feature IA (seed des 6 features) | Non | Service role only (RLS sans policy client) | Lue par featureModel.ts + panel admin ; UPDATE → seed obligatoire |
| `0012_ai_prompts.sql` | Overrides admin des system prompts (key/template/scope/version) | Non | Service role only (RLS sans policy client) | Fallback PROMPT_DEFAULTS ; upsert au save |
| `0013_ecos_cases.sql` | Cas ECOS fictifs versionnés | Non si cas synthétiques uniquement | Lecture selon entitlement étudiant | Ne jamais importer de cas patient réel |
| `0014_feature_quotas.sql` | Quotas par feature et compteurs associés | Non | Service role only | Remplace la logique « quota chat unique » par une matrice extensible |
| `0015_ai_model_params.sql` | Réglages de génération par feature (temperature, reasoning_effort, verbosity, web_search) sur `ai_model_config` | Non | Service role only (hérite du verrou 0011) | Lus par featureModel.ts (`getFeatureSettings`), appliqués par featureRuntime.ts ; 0013/0014 réservés |
| `0016_verified_personas.sql` | Ensemble des rôles vérifiés par compte (`verified_personas persona[]`) + extension du verrou anti-élévation 0005 | Non | Own-row (lecture) + écriture service role | Bascule libre entre chats des rôles validés ; défaut `{public}` ; lu par AuthProvider, écrit par `/api/role` (ADR-0020) |
| `0017_profile_personal_info.sql` | Infos perso de profil (`first_name`, `last_name`, `age`, `sex`) + contraintes CHECK | Non (données perso, pas de santé) | Own-row (lecture + écriture user) | HORS verrou anti-élévation ; personnalise l'information générale du chat ; jamais diagnostic/anamnèse (ADR-0021) |
| `0018_ecos_cases_align_schema.sql` | Réconcilie `ecos_cases` (schéma FR dérivé en prod) vers le schéma du dépôt (`title`/`specialty`/`brief` + `patient_profile`/`grading_grid` jsonb) | Non (cas fictifs) | Lecture cas publiés | Corrige « column ecos_cases.title does not exist » ; idempotente, préserve les 16 cas |
| `0019_audio_documents.sql` | Bibliothèque transcriptions/comptes rendus audio (`title`, `folder`, `transcription`, `report`, `audio_path`, `audio_expires_at`) | Donnée sensible (consultation) | Own-row stricte (CRUD propriétaire) | Texte conservé indéfiniment ; audio ≤24h purgé par `pg_cron` (`supabase/setup/audio_storage_and_purge.sql`, hors harness) ; export PDF ; ADR-0022 |

> Si une migration ci-dessus n'existe pas encore dans `supabase/migrations/`, la documenter comme décision attendue et ne pas modifier le schéma sans tests RLS correspondants.
> Note : `supabase/setup/` contient le setup Supabase-spécifique (bucket Storage `consultation-audio`, RLS Storage, purge `pg_cron`) NON rejoué par le harness RLS CI ; appliqué directement sur le projet via MCP.

## Points de vigilance

- Les features professionnelles cliniques restent gelées par ADR-0006 même si le RPPS devient vérifié.
- Les cas ECOS doivent rester des vignettes pédagogiques fictives ; un cas réel anonymisé reste refusé.
- Les quotas ne doivent jamais limiter l'accès aux sources de sécurité (HAS/ANSM) ni transformer une réponse refusée en réponse payante.
- Toute nouvelle table utilisateur : RLS active + test `tests/rls/` avant merge.

---

# MedInfo AI — Guide développement

## ⚠️ CONVENTION OBLIGATOIRE : Nouvelle fonctionnalité IA

Chaque fois qu'une **nouvelle fonctionnalité IA** est ajoutée (nouvelle API route qui appelle un LLM, nouveau mode dans une route existante), tu dois obligatoirement :

### 1. Déclarer la fonctionnalité dans le registre admin
Fichier : `src/admin/index.ts` → tableau `AI_FEATURES`

```ts
{
  key: 'ma_feature',          // identifiant unique snake_case
  emoji: '🔧',
  label: 'Ma fonctionnalité',
  description: 'Ce que fait cette fonctionnalité',
  apiRoute: '/api/ma-route',
  promptKeys: ['ma_feature'], // clés des prompts utilisés
  providers: ['anthropic', 'openai'], // providers compatibles
}
```

### 2. Ajouter le modèle par défaut dans featureModel.ts
Fichier : `src/ai/providers/featureModel.ts` → objet `FEATURE_DEFAULTS`

```ts
ma_feature: { modelId: 'claude-sonnet-4-6', provider: 'anthropic' },
```

### 3. Ajouter la ligne dans la migration SQL
```sql
INSERT INTO ai_model_config (key, model_id, label, provider) VALUES
  ('ma_feature', 'claude-sonnet-4-6', 'Ma fonctionnalité', 'anthropic');
```

### 4. Enregistrer le prompt dans promptStore.ts
Fichier : `src/ai/prompts/promptStore.ts` → objet `PROMPT_DEFAULTS`

```ts
ma_feature: {
  label: 'Ma fonctionnalité',
  scope: 'Nom de la catégorie',
  template: `Le prompt système ici...`,
},
```

### 5. Utiliser getModelForFeature() et getPromptTemplate() dans l'API
```ts
import { getModelForFeature } from '@/ai/providers/featureModel';
import { getPromptTemplate } from '@/ai/prompts/promptStore';

const [model, systemPrompt] = await Promise.all([
  getModelForFeature('ma_feature'),
  getPromptTemplate('ma_feature'),
]);
```

### 6. Ajouter le commentaire de convention dans le fichier API
```ts
/**
 * ⚠️  CONVENTION : le modèle utilisé (feature key: "ma_feature") est configurable
 * depuis le panel admin (app/(admin)/index.tsx).
 * Si tu ajoutes une étape IA ici, déclare-la dans src/admin/index.ts AI_FEATURES.
 */
```

---

## Architecture IA

| Fichier | Rôle |
|---------|------|
| `src/admin/index.ts` | Registre de toutes les features IA + contrôle accès admin |
| `src/ai/providers/featureModel.ts` | Sélection du modèle par feature (cache 60s depuis Supabase) |
| `src/ai/prompts/promptStore.ts` | Chargement des prompts (Supabase override > fichiers TS) |
| `app/(admin)/index.tsx` | Panel admin UI (modèles + prompts) |
| `app/api/admin/config+api.ts` | API admin (lecture/écriture config) |

| `src/ai/providers/featureRuntime.ts` | Construit les options d'appel LLM par feature (température, raisonnement, verbosité, web search) → `getRuntimeForFeature()` |

Tables Supabase (service role only, RLS sans policy) :
- `ai_model_config` — migration `0011_ai_model_config.sql` (seed des 6 features ; le POST admin fait un UPDATE, les lignes doivent préexister).
- `ai_prompts` — migration `0012_ai_prompts.sql` (overrides des prompts ; table vide, fallback sur `PROMPT_DEFAULTS`).
- Réglages de génération par feature — migration `0015_ai_model_params.sql` (colonnes `temperature`, `reasoning_effort`, `verbosity`, `web_search` sur `ai_model_config`).

### Réglages par fonctionnalité (panel admin → onglet Modèles)
Chaque feature expose, **selon les capacités du modèle choisi** (`AVAILABLE_MODELS[].capabilities` dans `featureModel.ts`) :
- **Raisonnement** (`reasoning_effort` : minimal/low/medium/high) — OpenAI `reasoningEffort` ; Anthropic → budget *thinking*.
- **Verbosité** (`verbosity` : low/medium/high) — OpenAI `textVerbosity` (gpt-5.x).
- **Température** (0–2).
- **Recherche internet** (`web_search`, OFF par défaut) — outil web du provider (OpenAI / Anthropic). Pour le chat, le RAG *cite-or-refuse* reste prioritaire ; n'activer qu'en connaissance de cause.

Les réglages sont appliqués au call LLM par `getRuntimeForFeature()` dans toutes les routes IA.

## Panel admin

Accessible depuis **Mon compte → Ouvrir le panel admin IA** (comptes admin seulement).

Comptes admin : `medaifr1@gmail.com`, `h.bilal0@icloud.com`
Pour ajouter un admin : modifier `ADMIN_USER_IDS` dans `src/admin/index.ts`.

## Fonctionnalités IA actuelles

| Feature key | Route API | Modèle par défaut | Audience |
|-------------|-----------|-------------------|----------|
| `chat` | `/api/chat` | claude-sonnet-4-6 | Tous |
| `analyze` | `/api/analyze` | claude-sonnet-4-6 | Grand public |
| `ecos_simulate` | `/api/ecos` | claude-sonnet-4-6 | Étudiant |
| `ecos_evaluate` | `/api/ecos` | claude-sonnet-4-6 | Étudiant |
| `audio_diarize` | `/api/transcribe` | gpt-4o-mini | Professionnel |
| `audio_report` | `/api/transcribe` | gpt-4o-mini | Professionnel |

## Visibilité des fonctionnalités par rôle (persona)

Chaque rôle ne voit QUE ses outils (le grand public ne voit pas les outils
étudiant/pro, et inversement). Source de vérité unique :
`src/ai/routing/featureVisibility.ts` (module pur, testé dans
`tests/unit/feature-visibility.test.ts`).

| Outil | Grand public | Étudiant | Professionnel | Admin |
|---|:---:|:---:|:---:|:---:|
| 💬 Chat santé | ✅ | ✅ | ✅ | ✅ |
| 📄 Analyse de document | ✅ | — | — | ✅ |
| 🩺 ECOS | — | ✅ | — | ✅ |
| 📊 Classement (analyseur de promo) | — | ✅ | — | ✅ |
| 🎤 Audio (compte rendu) | — | — | ✅ | ✅ |

Application :
- Barre d'onglets `app/(chat)/_layout.tsx` : onglet masqué via `href: null` si non visible.
- Menu déroulant d'outils `src/ui/ToolsMenu.tsx` (en-tête) : switch rôle-aware depuis n'importe quel écran.
- Garde d'écran `<RoleGate feature="…">` (`src/ui/RoleGate.tsx`) sur Document/ECOS/Classement/Audio
  (défense en profondeur contre l'accès direct / deep-link).
- Écran Compte : section « Mes outils » listant les outils du rôle courant.
- Dictée vocale `src/ui/DictationButton.tsx` (Whisper, `/api/transcribe` mode `raw`) dans les saisies de chat/ECOS.
- **Sécurité** : le masquage UI n'est jamais l'unique barrière. L'autorisation réelle des routes
  IA reste dérivée du profil vérifié côté serveur (`serverPersona.ts` ; garde persona étudiant/admin
  dans `/api/partiel`). ADR-0018.
