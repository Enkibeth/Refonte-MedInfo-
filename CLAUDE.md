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
