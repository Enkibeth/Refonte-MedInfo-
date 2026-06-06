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
- Réglages de génération par feature — migration `0013_ai_model_params.sql` (colonnes `temperature`, `reasoning_effort`, `verbosity`, `web_search` sur `ai_model_config`).

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

| Feature key | Route API | Modèle par défaut |
|-------------|-----------|-------------------|
| `chat` | `/api/chat` | claude-sonnet-4-6 |
| `analyze` | `/api/analyze` | claude-sonnet-4-6 |
| `ecos_simulate` | `/api/ecos` | claude-sonnet-4-6 |
| `ecos_evaluate` | `/api/ecos` | claude-sonnet-4-6 |
| `audio_diarize` | `/api/transcribe` | gpt-4o-mini |
| `audio_report` | `/api/transcribe` | gpt-4o-mini |
