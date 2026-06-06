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

## Quotas d'usage PAR FEATURE (facturation)

Deux couches de limitation coexistent :

1. **Anti-flood JOURNALIER GLOBAL par persona** — `src/ai/rateLimit/chatRateLimit.ts`
   + migration `0004_usage_counters.sql`. Compteur journalier (user/persona ou IP). Inchangé.
2. **Quota MENSUEL PAR FEATURE** — `src/billing/usage.ts` + migration `0014_entitlements.sql`
   (table `feature_usage_counters` + RPC `consume_feature_quota`, check-and-consume atomique).
   Modulé par le plan d'abonnement (freemium tiered, 06_BILLING §1).

### Fonction centrale

```ts
import { enforceFeatureQuota, quotaExceededResponse } from '@/billing/usage';

const quota = await enforceFeatureQuota(request, 'analyze'); // 'chat' | 'analyze' | 'ecos' | 'audio'
if (!quota.allowed) return quotaExceededResponse(quota); // 429 + message FR
```

`enforceFeatureQuota(request, feature, amount?)` résout l'utilisateur depuis le Bearer token
puis appelle `checkAndConsume(userId, feature, amount)`. Les **anonymes** (sans token) ne sont
PAS décomptés ici (`skipped=true`) → ils restent gouvernés par le cap journalier IP (0004),
ce qui **préserve le comportement gratuit existant**.

### Barème par défaut (`FEATURE_QUOTAS` dans `src/billing/usage.ts`)

| Feature | Gratuit (free) | Plans payants | Unité | Décompté dans |
|---------|----------------|---------------|-------|----------------|
| `chat` | 300/mois | illimité | message | `/api/chat` (auth.) |
| `analyze` | 10/mois | illimité | analyse | `/api/analyze` |
| `ecos` | 10/mois | illimité* | session (1 par évaluation) | `/api/ecos` (mode `evaluate`) |
| `audio` | 30/mois | illimité | minute (estimée ≈ taille/1 Mo) | `/api/transcribe` |

\* `public_mid` n'a pas l'ECOS (feature étudiante) → quota 0. Les plans payants lèvent les
plafonds de volume (cohérent avec `resolveEntitlement().unlimitedMessages`, 06_BILLING §1).

**INVARIANT 06_BILLING §5** : ces quotas ne portent QUE sur le VOLUME, jamais sur l'accès aux
sources (HAS/ANSM restent gratuites pour tous). **RLS** : lecture own-row (`authenticated`),
écriture service_role only (anti-tampering). Tests : `tests/unit/billing-usage.test.ts`,
`tests/rls/usage-isolation.test.ts`.
