/**
 * Sélection de modèle + réglages par fonctionnalité IA.
 * Lit la config depuis Supabase (table ai_model_config) avec cache 60s.
 * Fallback sur le provider actif par défaut si la table est inaccessible.
 *
 * ⚠️  CONVENTION : quand tu ajoutes une nouvelle fonctionnalité IA, ajoute
 * son key ici dans FEATURE_DEFAULTS et dans src/admin/index.ts AI_FEATURES.
 * Voir aussi les migrations SQL ai_model_config (0011) et ai_model_params (0015).
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

/**
 * Capacités d'un modèle = quels réglages le panel admin doit exposer.
 *  - temperature : accepte le paramètre `temperature`.
 *  - reasoning   : effort de raisonnement (OpenAI gpt-5.x / Anthropic thinking).
 *  - verbosity   : contrôle de longueur de réponse (OpenAI gpt-5.x).
 *  - webSearch   : supporte un outil de recherche internet côté provider.
 */
export interface ModelCapabilities {
  temperature: boolean;
  reasoning: boolean;
  verbosity: boolean;
  webSearch: boolean;
}

/** Models disponibles dans l'UI admin (avec leurs capacités de réglage). */
export const AVAILABLE_MODELS = [
  {
    id: 'claude-sonnet-4-6', provider: 'anthropic', label: 'Claude Sonnet 4.6',
    capabilities: { temperature: true, reasoning: true, verbosity: false, webSearch: true },
  },
  {
    id: 'claude-opus-4-8', provider: 'anthropic', label: 'Claude Opus 4.8',
    capabilities: { temperature: true, reasoning: true, verbosity: false, webSearch: true },
  },
  {
    id: 'claude-haiku-4-5-20251001', provider: 'anthropic', label: 'Claude Haiku 4.5',
    capabilities: { temperature: true, reasoning: true, verbosity: false, webSearch: true },
  },
  {
    id: 'gpt-5.5', provider: 'openai', label: 'GPT-5.5',
    capabilities: { temperature: true, reasoning: true, verbosity: true, webSearch: true },
  },
  {
    id: 'gpt-4o', provider: 'openai', label: 'GPT-4o',
    capabilities: { temperature: true, reasoning: false, verbosity: false, webSearch: true },
  },
  {
    id: 'gpt-4o-mini', provider: 'openai', label: 'GPT-4o mini',
    capabilities: { temperature: true, reasoning: false, verbosity: false, webSearch: false },
  },
] as const;

export type ReasoningEffort = 'minimal' | 'low' | 'medium' | 'high';
export type Verbosity = 'low' | 'medium' | 'high';

/** Réglages effectifs d'une fonctionnalité (modèle + paramètres de génération). */
export interface FeatureSettings {
  modelId: string;
  provider: string;
  temperature: number | null;
  reasoningEffort: ReasoningEffort | null;
  verbosity: Verbosity | null;
  webSearch: boolean;
}

function defaultSettings(feature: FeatureKey): FeatureSettings {
  const base = FEATURE_DEFAULTS[feature];
  return {
    modelId: base.modelId,
    provider: base.provider,
    temperature: null,
    reasoningEffort: null,
    verbosity: null,
    webSearch: false,
  };
}

/** Retourne les capacités d'un modèle (ou tout-faux si inconnu). */
export function getModelCapabilities(modelId: string): ModelCapabilities {
  const m = AVAILABLE_MODELS.find((x) => x.id === modelId);
  return m
    ? m.capabilities
    : { temperature: false, reasoning: false, verbosity: false, webSearch: false };
}

// ── Cache mémoire (60 secondes) ──────────────────────────────────────────────
interface CacheEntry {
  data: Record<string, FeatureSettings>;
  expiresAt: number;
}
let cache: CacheEntry | null = null;

async function fetchConfig(): Promise<Record<string, FeatureSettings>> {
  if (cache && Date.now() < cache.expiresAt) return cache.data;

  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return {};

  try {
    const client = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data, error } = await client
      .from('ai_model_config')
      .select('key, model_id, provider, temperature, reasoning_effort, verbosity, web_search');

    if (error || !data) return {};

    const config: Record<string, FeatureSettings> = {};
    for (const row of data) {
      config[row.key] = {
        modelId: row.model_id,
        provider: row.provider,
        temperature: row.temperature ?? null,
        reasoningEffort: (row.reasoning_effort as ReasoningEffort | null) ?? null,
        verbosity: (row.verbosity as Verbosity | null) ?? null,
        webSearch: Boolean(row.web_search),
      };
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

/** Réglages complets d'une fonctionnalité (DB > défaut). */
export async function getFeatureSettings(feature: FeatureKey): Promise<FeatureSettings> {
  const config = await fetchConfig();
  return config[feature] ?? defaultSettings(feature);
}

export async function getModelForFeature(feature: FeatureKey): Promise<LanguageModel> {
  const s = await getFeatureSettings(feature);
  return buildModel(s.modelId, s.provider);
}

export async function getModelIdForFeature(feature: FeatureKey): Promise<string> {
  const s = await getFeatureSettings(feature);
  return s.modelId;
}
