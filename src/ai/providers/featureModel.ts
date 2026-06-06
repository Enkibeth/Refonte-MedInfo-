/**
 * Sélection de modèle par fonctionnalité IA.
 * Lit la config depuis Supabase (table ai_model_config) avec cache 60s.
 * Fallback sur le provider actif par défaut si la table est inaccessible.
 *
 * ⚠️  CONVENTION : quand tu ajoutes une nouvelle fonctionnalité IA, ajoute
 * son key ici dans FEATURE_DEFAULTS et dans src/admin/index.ts AI_FEATURES.
 * Voir aussi la migration SQL ai_model_config.
 */
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { createClient } from '@supabase/supabase-js';
import type { LanguageModel } from 'ai';
import type { FeatureKey } from '@/admin/index';

/** Modèles par défaut si Supabase est inaccessible. */
const FEATURE_DEFAULTS: Record<FeatureKey, { modelId: string; provider: string }> = {
  chat:           { modelId: 'claude-sonnet-4-6', provider: 'anthropic' },
  analyze:        { modelId: 'claude-sonnet-4-6', provider: 'anthropic' },
  ecos_simulate:  { modelId: 'claude-sonnet-4-6', provider: 'anthropic' },
  ecos_evaluate:  { modelId: 'claude-sonnet-4-6', provider: 'anthropic' },
  audio_diarize:  { modelId: 'gpt-4o-mini',       provider: 'openai' },
  audio_report:   { modelId: 'gpt-4o-mini',       provider: 'openai' },
};

/** Models disponibles dans l'UI admin. */
export const AVAILABLE_MODELS = [
  { id: 'claude-sonnet-4-6',        provider: 'anthropic', label: 'Claude Sonnet 4.6' },
  { id: 'claude-opus-4-8',          provider: 'anthropic', label: 'Claude Opus 4.8' },
  { id: 'claude-haiku-4-5-20251001',provider: 'anthropic', label: 'Claude Haiku 4.5' },
  { id: 'gpt-4o',                   provider: 'openai',    label: 'GPT-4o' },
  { id: 'gpt-4o-mini',              provider: 'openai',    label: 'GPT-4o mini' },
] as const;

// ── Cache mémoire (60 secondes) ──────────────────────────────────────────────
interface CacheEntry {
  data: Record<string, { modelId: string; provider: string }>;
  expiresAt: number;
}
let cache: CacheEntry | null = null;

async function fetchConfig(): Promise<Record<string, { modelId: string; provider: string }>> {
  if (cache && Date.now() < cache.expiresAt) return cache.data;

  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return {};

  try {
    const client = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data, error } = await client
      .from('ai_model_config')
      .select('key, model_id, provider');

    if (error || !data) return {};

    const config: Record<string, { modelId: string; provider: string }> = {};
    for (const row of data) {
      config[row.key] = { modelId: row.model_id, provider: row.provider };
    }
    cache = { data: config, expiresAt: Date.now() + 60_000 };
    return config;
  } catch {
    return {};
  }
}

export function invalidateConfigCache() {
  cache = null;
}

function buildModel(modelId: string, provider: string): LanguageModel {
  if (provider === 'openai') return openai(modelId);
  return anthropic(modelId);
}

export async function getModelForFeature(feature: FeatureKey): Promise<LanguageModel> {
  const config = await fetchConfig();
  const entry = config[feature] ?? FEATURE_DEFAULTS[feature];
  return buildModel(entry.modelId, entry.provider);
}

export async function getModelIdForFeature(feature: FeatureKey): Promise<string> {
  const config = await fetchConfig();
  return config[feature]?.modelId ?? FEATURE_DEFAULTS[feature].modelId;
}
