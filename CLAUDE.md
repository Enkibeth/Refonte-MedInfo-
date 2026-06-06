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
Ajoute un INSERT dans une nouvelle migration (numéro libre après `0012`) :
```sql
INSERT INTO public.ai_model_config (key, model_id, provider, label) VALUES
  ('ma_feature', 'claude-sonnet-4-6', 'anthropic', 'Ma fonctionnalité');
```
> Les tables `ai_model_config` et `ai_prompts` sont créées par les migrations `0011` et `0012`.
> Le POST admin fait un `UPDATE` (pas upsert) sur `ai_model_config` → la ligne doit préexister.

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

## Migrations DB (Supabase)

| Migration | Contenu |
|-----------|---------|
| `0001_profiles.sql` | Table `profiles`, trigger `handle_new_user` |
| `0002_ai_interactions.sql` | Table `ai_interactions` (audit, service_role only) |
| `0003_harden_handle_new_user.sql` | Durcissement trigger |
| `0004_usage_counters.sql` | Table `usage_counters`, fonction `increment_usage_counter` |
| `0005_profile_verification.sql` | Colonnes de vérification professionnelle |
| `0006_rag_pgvector.sql` | Tables RAG + fonction `match_rag_chunks` |
| `0007_subscriptions.sql` | Table `subscriptions` |
| `0008_billing_events.sql` | Table `billing_events` (Stripe webhook) |
| `0009_rag_match_or_semantics.sql` | Fallback lexical RAG |
| `0010_db_hardening.sql` | `search_path` figé, `(select auth.uid())` perf fix |
| `0011_ai_model_config.sql` | Table `ai_model_config` + seed 6 features (service_role only) |
| `0012_ai_prompts.sql` | Table `ai_prompts` pour overrides admin (service_role only) |
| `0013_ecos_cases.sql` | Table `ecos_cases` + seed 16 cas (SELECT public sur is_published) |

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
