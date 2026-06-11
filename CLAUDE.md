# CLAUDE.md — État IA / Supabase pour reprise par agents

```yaml
status: Active
date: 2026-06-10
owner: Hugo Bettembourg
scope: Documentation de reprise pour agents IA (Claude Code / Codex)
```

## ⚠️ Refonte 2026-06 (ADR-0024) : chat direct sans safe-box — sécurité à réintroduire après validation de l'ébauche par Hugo

> **Décision Hugo : refonte complète du chat. On valide d'abord une ébauche produit fonctionnelle, on réintroduit les couches de sécurité par-dessus ensuite.**
>
> `/api/chat` (`app/api/chat+api.ts`) est désormais un appel LLM **direct** : plus de
> classifieur pré-LLM, plus de guardrails/validation de sortie, plus de RAG injecté,
> plus de rate-limit sur le chat. Les modules correspondants sont **supprimés** du dépôt
> (`src/ai/orchestrator.ts`, `src/ai/classifier/*`, `src/ai/guardrails/*`, `src/ai/skills/*`,
> `src/ai/ui/*`, anciens prompts v1/v2, tests classifier/guardrails/prompt-regression) —
> contrairement à l'ADR-0023 qui les conservait derrière un interrupteur.
> 3 chatbots = 3 prompts produit complets fournis par Hugo (`public.v3`, `student.v3`,
> `professional.v2`). Le client choisit son chatbot (`body.chatbot`) ; côté serveur,
> `allowedChatbotsFor(persona vérifiée)` : public → chat public seulement ;
> étudiant/professionnel → les 3 chats.
> Restent actifs : disclosure passive, autorisation persona serveur, rate-limit sur
> `/api/analyze` et `/api/ecos` (`src/ai/rateLimit/`).
> Tant que ce bandeau est présent, la règle #2 ci-dessous est **relâchée par ADR-0024**
> (qui remplace ADR-0023). La réintroduction de la sécurité est planifiée après validation
> de l'ébauche par Hugo (voir « Suivi » de l'ADR-0024).

## Règles de reprise

1. Lire `START.md`, `.ai-governance.md`, `docs/01_REGULATION.md`, puis `docs/README.md` avant tout changement.
2. Ne jamais dégrader la safe-box non-MDSW : classifieur avant LLM principal, refus déterministe en cas de doute, RAG cite-or-refuse. **(Relâchée temporairement par ADR-0024 — voir bandeau ci-dessus ; à rétablir lors de la réintroduction de la sécurité après validation de l'ébauche.)**
3. Ne pas implémenter d'historique patient, dossier, triage, diagnostic ou CAT individualisée sans ADR `Proposed` + arbitrage Hugo.
4. Une feature par branche dédiée ; documentation et ADR doivent accompagner chaque décision structurante.

## Tableau des features IA

| Feature | Statut | Surface / audience | Source de vérité | Sécurité / conformité | ADR |
|---|---|---|---|---|---|
| Chat direct 3 chatbots (refonte 2026-06) | Actif | Public (chat public) ; étudiant/pro vérifiés (les 3 chats) | `app/api/chat+api.ts`, prompts `src/ai/prompts/public.v3.ts` / `student.v3.ts` / `professional.v2.ts`, contexte profil `src/ai/chat/chatContext.ts` | Appel LLM direct (gpt-5.2, web_search ON) ; pas de classifieur/guardrails/RAG/rate-limit sur le chat (temporaire) ; `allowedChatbotsFor()` serveur ; disclosure AI Act conservée | ADR-0024 |
| Parseur + rendu interactif des réponses chat | Actif | Tous (chat) | `src/ai/chat/parseAssistantMessage.ts`, `src/ui/chat/AssistantBlocks.tsx`, `src/ui/chat/SourceDetailModal.tsx` | Parse SOURCES `SRCn::`, badges OFFICIEL/GUIDELINE/ÉTUDE/RCP, APPROFONDISSEMENTS, QUESTIONS_PATIENT, INTERACTION, AUTO-RÉFLEXION, `<!--CALC:…-->`, `[1]+[2]+[3]` étudiant ; clic sur une source → modale niveau de preuve + bouton « Accéder à la source » (jamais d'ouverture directe du lien) ; bulle de statut pendant la génération (réfléchit / recherche de sources / rédige, via l'activité d'outil du stream) ; rendu 100% client | ADR-0024 |
| Historique des conversations + export PDF | Actif | Tous (chat) | `src/chat/history.ts`, `src/ui/chat/HistoryPanel.tsx`, `src/ui/chat/ChatbotSwitcher.tsx`, `src/chat/exportChatPdf.ts`, migration `0020_chat_history.sql` | RLS own-row stricte (`chat_conversations`/`chat_messages`), test `tests/rls/chat-history.test.ts` ; contenu potentiellement sensible | ADR-0024 |
| Titre + catégorie de conversation `chat_meta` | Actif | Tous (chat) | `app/api/chat-meta+api.ts`, défaut `gemini-2.5-flash` (provider google) | Génère uniquement titre/catégorie ; pas de conseil médical ; configurable panel admin | ADR-0024 |
| RAG HAS/ANSM MVP | Conservé, non branché sur le chat | Documentaire (réutilisation future) | `rag_sources`, `rag_chunks`, `match_rag_chunks`, `src/rag/retrieval.ts` | Sources publiques whitelistées, métadonnées validées ; plus injecté dans `/api/chat` depuis la refonte (ADR-0024) | ADR-0014, ADR-0024 |
| Embeddings RAG réels | Pipeline livré, peuplement à faire | Retrieval documentaire | `text-embedding-3-small`, `scripts/embeddings/ingest-corpus.mjs` | Zéro pseudo-embedding ; lexical-only si clé/réseau échoue ; EU residency/ZDR à activer avant prod | ADR-0014 |
| Vérification étudiant | Actif | Choix rôle étudiant | `profiles`, route `app/api/role+api.ts` | E-mail académique / statut serveur, anti-auto-promotion RLS | ADR-0011 |
| Vérification RPPS / ANS | Configurée côté décision, activation contrôlée | Professionnels de santé | API FHIR Annuaire Santé, statut `pending` tant que clé absente | RPPS = donnée personnelle publique ; pro routable mais features cliniques gelées | ADR-0007, ADR-0011 |
| Facturation Stripe | Actif web-first | Plans public + étudiant | `subscriptions`, `billing_events`, webhook Stripe | Paywall = volume/features uniquement ; ne gate jamais les sources | ADR-0012 |
| Quotas par feature | Décidé / à maintenir côté serveur | Chat, ECOS, exports, transcriptions | Tables de limites/compteurs techniques, entitlements serveur | Quota découplé des sources ; service_role only ; aucune auto-promotion client | ADR-0016 |
| Cas ECOS en base | Décidé / feature pédagogique | Étudiants vérifiés | Tables de cas/stations pédagogiques versionnées | Cas explicitement fictifs ; aucun patient réel ; séparation du chat médical | ADR-0017 |
| Analyseur de classement (medoutils) | Actif (v1) | Étudiants vérifiés | `app/(chat)/partiel.tsx`, logique pure `src/lib/classement.ts` | Import CSV/TSV des notes de promo (upload web ou collage) → rang, stats, comparaison par n° étudiant ; calcul 100% client (aucune donnée envoyée, sans IA) | ADR-0019 |
| Visibilité des outils par rôle + menu d'outils | Actif | Tous (UI adaptée) | `src/ai/routing/featureVisibility.ts`, `src/ui/RoleGate.tsx`, `src/ui/ToolsMenu.tsx`, `app/(chat)/_layout.tsx` | Cloisonnement UI strict par persona ; menu déroulant rôle-aware ; jamais l'unique barrière (autorisation serveur conservée) | ADR-0018 |
| Dictée vocale (chat/ECOS) | Actif | Tous | `src/ui/DictationButton.tsx`, `/api/transcribe` mode `raw` | Voix → texte (Whisper) dans les saisies ; transcription brute ; le texte repasse par l'autorisation de la route cible (safe-box retirée du chat par ADR-0024) | ADR-0019 |

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
| `0020_chat_history.sql` | Historique du chat : `chat_conversations` (chatbot, `title`/`category` générés par `chat_meta`) + `chat_messages` (user/assistant) | Potentiellement sensible (questions de santé) | Own-row stricte (CRUD propriétaire ; insert message vérifié contre la conversation du user) | Test `tests/rls/chat-history.test.ts` ; ADR-0024 |
| `0021_ai_model_config_refonte.sql` | Seed feature `chat_meta` (gemini-2.5-flash, google) + update `chat` → `gpt-5.2` (openai) avec `web_search = true` | Non | Service role only (hérite du verrou 0011) | Refonte 2026-06 ; le POST admin fait un UPDATE, la ligne `chat_meta` doit préexister ; ADR-0024 |

> Si une migration ci-dessus n'existe pas encore dans `supabase/migrations/`, la documenter comme décision attendue et ne pas modifier le schéma sans tests RLS correspondants.
> Note : `supabase/setup/` contient le setup Supabase-spécifique (bucket Storage `consultation-audio`, RLS Storage, purge `pg_cron`) NON rejoué par le harness RLS CI ; appliqué directement sur le projet via MCP.

## Points de vigilance

- `chat_meta` (titre/catégorie d'historique) requiert `GOOGLE_GENERATIVE_AI_API_KEY` côté serveur (Vercel) ; sans clé, repli déterministe sur les premiers mots de la question (l'archivage fonctionne quand même).

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
- `ai_model_config` — migrations `0011_ai_model_config.sql` (seed initial) + `0021_ai_model_config_refonte.sql` (seed `chat_meta`, chat → gpt-5.2 + web_search) ; le POST admin fait un UPDATE, les lignes doivent préexister.
- `ai_prompts` — migration `0012_ai_prompts.sql` (overrides des prompts ; table vide, fallback sur `PROMPT_DEFAULTS`).
- Réglages de génération par feature — migration `0015_ai_model_params.sql` (colonnes `temperature`, `reasoning_effort`, `verbosity`, `web_search` sur `ai_model_config`).

### Réglages par fonctionnalité (panel admin → onglet Modèles)
Chaque feature expose, **selon les capacités du modèle choisi** (`AVAILABLE_MODELS[].capabilities` dans `featureModel.ts`) :
- **Raisonnement** (`reasoning_effort` : minimal/low/medium/high) — OpenAI `reasoningEffort` ; Anthropic → budget *thinking*.
- **Verbosité** (`verbosity` : low/medium/high) — OpenAI `textVerbosity` (gpt-5.x).
- **Température** (0–2).
- **Recherche internet** (`web_search`, OFF par défaut sauf `chat`) — outil web du provider (OpenAI / Anthropic / Google). Pour le chat, `web_search` est **ON par défaut** depuis la refonte 2026-06 (migration 0021) : les prompts v3 exigent des sources réelles vérifiables (HAS/ESC/PubMed…).

Les réglages sont appliqués au call LLM par `getRuntimeForFeature()` dans toutes les routes IA.

## Panel admin

Accessible depuis **Mon compte → Ouvrir le panel admin IA** (comptes admin seulement).

Comptes admin : `medaifr1@gmail.com`, `h.bilal0@icloud.com`
Pour ajouter un admin : modifier `ADMIN_USER_IDS` dans `src/admin/index.ts`.

## Fonctionnalités IA actuelles

| Feature key | Route API | Modèle par défaut | Audience |
|-------------|-----------|-------------------|----------|
| `chat` | `/api/chat` | gpt-5.2 (web_search ON) | Tous — 3 chatbots (prompts `public`/`student`/`professional`) ; public → chat public seul, étudiant/pro vérifiés → les 3 |
| `chat_meta` | `/api/chat-meta` | gemini-2.5-flash | Tous (titre + catégorie d'une conversation) |
| `analyze` | `/api/analyze` | claude-sonnet-4-6 | Grand public |
| `ecos_simulate` | `/api/ecos` | claude-sonnet-4-6 | Étudiant |
| `ecos_evaluate` | `/api/ecos` | claude-sonnet-4-6 | Étudiant |
| `audio_diarize` | `/api/transcribe` | gpt-4o-mini | Professionnel |
| `audio_report` | `/api/transcribe` | gpt-4o-mini | Professionnel |

## Visibilité des fonctionnalités par rôle (persona)

Chaque rôle ne voit QUE ses outils (le grand public ne voit pas les outils
étudiant/pro, et inversement). Le chat est commun à tous, mais les **3 chatbots**
(public/étudiant/professionnel) ne sont accessibles qu'aux comptes étudiant/pro
vérifiés et aux admins ; le grand public n'a que le chat public. Source de vérité
unique : `src/ai/routing/featureVisibility.ts` (module pur, testé dans
`tests/unit/feature-visibility.test.ts`) ; côté serveur `allowedChatbotsFor()`
dans `app/api/chat+api.ts`. La navigation utilise des icônes ligne (plus d'emojis).

> **⚠️ Icônes (piège connu)** : les chemins SVG vivent dans `src/ui/iconPaths.ts`, avec DEUX
> implémentations de `<Icon>` : `src/ui/icons.tsx` (natif, `<Image>` data-URI) et
> `src/ui/icons.web.tsx` (web, `<svg>` inline, résolu automatiquement par Metro). Les data-URI
> SVG dans `<Image>` sont INVISIBLES sur l'export web de production — toujours passer par
> `icons.web.tsx` pour le web, et ajouter les nouveaux chemins dans `iconPaths.ts`.

> **⚠️ Design / animations (pièges connus, audit 2026-06)** : design system documenté dans
> `docs/05_DESIGN.md` (+ rapport `docs/audits/DESIGN_AUDIT_2026-06.md`). Sur react-native-web,
> la ref d'`Animated.View` n'expose PAS le nœud DOM : un `IntersectionObserver` posé dessus ne
> s'attache jamais (échec silencieux) — observer une sentinelle `View` 1×1 à la place (cf.
> `src/ui/Reveal.tsx`). Titres de page en Fraunces (`tokens.font.serif`), jamais en corps de
> texte. Tout mouvement doit rester coupé sous `prefers-reduced-motion`.

| Outil | Grand public | Étudiant | Professionnel | Admin |
|---|:---:|:---:|:---:|:---:|
| Chat santé (3 chatbots) | ✅ (chat public seul) | ✅ (les 3) | ✅ (les 3) | ✅ (les 3) |
| Analyse de document | ✅ | — | — | ✅ |
| ECOS | — | ✅ | — | ✅ |
| Classement (analyseur de promo) | — | ✅ | — | ✅ |
| Audio (compte rendu) | — | — | ✅ | ✅ |

Application :
- Barre d'onglets `app/(chat)/_layout.tsx` : onglet masqué via `href: null` si non visible.
- Accueil rôle-aware : étudiant/pro voient les 3 chats + leurs outils ; le public voit son chat.
- Switch de chatbot `src/ui/chat/ChatbotSwitcher.tsx` (étudiant/pro/admin uniquement).
- Menu déroulant d'outils `src/ui/ToolsMenu.tsx` (en-tête) : switch rôle-aware depuis n'importe quel écran.
- Garde d'écran `<RoleGate feature="…">` (`src/ui/RoleGate.tsx`) sur Document/ECOS/Classement/Audio
  (défense en profondeur contre l'accès direct / deep-link).
- Écran Compte : section « Mes outils » listant les outils du rôle courant.
- Dictée vocale `src/ui/DictationButton.tsx` (Whisper, `/api/transcribe` mode `raw`) dans les saisies de chat/ECOS.
- **Sécurité** : le masquage UI n'est jamais l'unique barrière. L'autorisation réelle des routes
  IA reste dérivée du profil vérifié côté serveur (`serverPersona.ts` ; garde persona étudiant/admin
  dans `/api/partiel`). ADR-0018.
