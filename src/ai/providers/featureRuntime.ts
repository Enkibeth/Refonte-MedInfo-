/**
 * Construction des options d'appel LLM par fonctionnalité, à partir des réglages
 * admin (getFeatureSettings) : température, effort de raisonnement, verbosité et
 * recherche internet. Centralise le mapping vers les `providerOptions` / `tools`
 * de l'AI SDK pour que toutes les routes appliquent la config de façon identique.
 *
 * ⚠️  CONVENTION : réglages configurables depuis le panel admin (app/(admin)/index.tsx),
 * stockés dans ai_model_config (migrations 0011 + 0015). Le toggle web_search n'est
 * exposé que pour les modèles dont les capabilities.webSearch === true
 * (cf AVAILABLE_MODELS dans featureModel.ts).
 */
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';
import type { FeatureKey } from '@/admin/index';
import {
  getFeatureSettings,
  getModelCapabilities,
  type FeatureSettings,
  type ReasoningEffort,
  type Verbosity,
} from './featureModel';

/** Options à étaler dans streamText/generateText. */
export interface FeatureCallOptions {
  temperature?: number;
  maxOutputTokens?: number;
  // Types provider-specific de l'AI SDK : on reste permissif pour rester compatible
  // entre versions de @ai-sdk/openai / @ai-sdk/anthropic.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  providerOptions?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools?: any;
}

/**
 * Surcharges par requête (non persistées) — ex. réglages utilisateur du chat.
 * Priment sur la config admin lue en base pour CETTE requête uniquement.
 */
export interface FeatureRuntimeOverrides {
  reasoningEffort?: ReasoningEffort | null;
  /**
   * PLAFOND d'effort de raisonnement (balance rapidité/qualité par chatbot) : abaisse
   * l'effort effectif au niveau donné s'il le dépasse, mais ne RELÈVE jamais (un effort
   * absent/null reste null — on n'active pas de thinking là où l'admin n'en a pas mis).
   */
  capReasoningEffort?: ReasoningEffort;
  verbosity?: Verbosity | null;
  webSearch?: boolean;
  maxOutputTokens?: number;
}

const REASONING_EFFORT_ORDER: Record<ReasoningEffort, number> = {
  minimal: 0,
  low: 1,
  medium: 2,
  high: 3,
};

/** Applique le plafond d'effort : abaisse si au-dessus, ne relève jamais (pur, testé). */
export function capReasoningEffort(
  effort: ReasoningEffort | null,
  cap: ReasoningEffort,
): ReasoningEffort | null {
  if (effort == null) return null;
  return REASONING_EFFORT_ORDER[effort] > REASONING_EFFORT_ORDER[cap] ? cap : effort;
}

export interface FeatureRuntime {
  model: LanguageModel;
  modelId: string;
  provider: string;
  settings: FeatureSettings;
  /** À étaler dans l'appel : `streamText({ model, ...options })`. */
  options: FeatureCallOptions;
}

// Anthropic n'a pas d'enum « effort » : on mappe vers un budget de thinking (tokens).
const ANTHROPIC_THINKING_BUDGET: Record<ReasoningEffort, number> = {
  minimal: 1024,
  low: 2048,
  medium: 6144,
  high: 12288,
};

function buildModel(modelId: string, provider: string): LanguageModel {
  if (provider === 'openai') return openai(modelId);
  if (provider === 'google') return google(modelId);
  return anthropic(modelId);
}

export async function getRuntimeForFeature(
  feature: FeatureKey,
  overrides: FeatureRuntimeOverrides = {},
): Promise<FeatureRuntime> {
  const base = await getFeatureSettings(feature);
  // Les surcharges par requête (réglages utilisateur) priment sur la config admin.
  const effort = overrides.reasoningEffort ?? base.reasoningEffort;
  const settings: FeatureSettings = {
    ...base,
    reasoningEffort:
      overrides.capReasoningEffort != null
        ? capReasoningEffort(effort, overrides.capReasoningEffort)
        : effort,
    verbosity: overrides.verbosity ?? base.verbosity,
    webSearch: overrides.webSearch ?? base.webSearch,
  };
  const caps = getModelCapabilities(settings.modelId);
  const model = buildModel(settings.modelId, settings.provider);

  const options: FeatureCallOptions = {};
  const providerOptions: Record<string, Record<string, unknown>> = {};
  const tools: Record<string, unknown> = {};

  // Température : seulement si le modèle l'accepte.
  if (caps.temperature && settings.temperature != null) {
    options.temperature = settings.temperature;
  }

  if (settings.provider === 'openai') {
    const oai: Record<string, unknown> = {};
    if (caps.reasoning && settings.reasoningEffort) oai.reasoningEffort = settings.reasoningEffort;
    if (caps.verbosity && settings.verbosity) oai.textVerbosity = settings.verbosity;
    if (Object.keys(oai).length > 0) providerOptions.openai = oai;

    if (caps.webSearch && settings.webSearch) {
      // L'API exacte de l'outil varie selon la version du provider ; on tente les
      // deux formes connues et on ignore silencieusement si indisponible.
      const t = openai as unknown as { tools?: Record<string, (...args: unknown[]) => unknown> };
      try {
        if (t.tools?.webSearch) tools.web_search = t.tools.webSearch({});
        else if (t.tools?.webSearchPreview) tools.web_search = t.tools.webSearchPreview({});
      } catch {
        /* outil indisponible dans cette version du SDK → on n'ajoute rien */
      }
    }
  } else if (settings.provider === 'anthropic') {
    if (caps.reasoning && settings.reasoningEffort) {
      const budget = ANTHROPIC_THINKING_BUDGET[settings.reasoningEffort];
      providerOptions.anthropic = {
        thinking: { type: 'enabled', budgetTokens: budget },
      };
      // Anthropic exige temperature non personnalisée quand thinking est actif, et
      // max_tokens > budget de thinking. On retire la température et on garantit une
      // marge de sortie suffisante (sauf override explicite plus bas).
      delete options.temperature;
      options.maxOutputTokens = budget + 4096;
    }

    if (caps.webSearch && settings.webSearch) {
      const t = anthropic as unknown as { tools?: Record<string, (...args: unknown[]) => unknown> };
      try {
        if (t.tools?.webSearch_20250305) tools.web_search = t.tools.webSearch_20250305({ maxUses: 5 });
      } catch {
        /* idem */
      }
    }
  } else if (settings.provider === 'google') {
    if (caps.webSearch && settings.webSearch) {
      const t = google as unknown as { tools?: Record<string, (...args: unknown[]) => unknown> };
      try {
        if (t.tools?.googleSearch) tools.google_search = t.tools.googleSearch({});
      } catch {
        /* idem */
      }
    }
  }

  // Override explicite du budget de sortie (ex. niveau de détail du chat). On respecte le
  // plancher imposé par le thinking Anthropic (max_tokens doit dépasser le budget).
  if (overrides.maxOutputTokens != null) {
    options.maxOutputTokens = Math.max(overrides.maxOutputTokens, options.maxOutputTokens ?? 0);
  }

  if (Object.keys(providerOptions).length > 0) options.providerOptions = providerOptions;
  if (Object.keys(tools).length > 0) options.tools = tools;

  return { model, modelId: settings.modelId, provider: settings.provider, settings, options };
}
