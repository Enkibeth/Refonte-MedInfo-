/**
 * Construction des options d'appel LLM par fonctionnalité, à partir des réglages
 * admin (getFeatureSettings) : température, effort de raisonnement, verbosité et
 * recherche internet. Centralise le mapping vers les `providerOptions` / `tools`
 * de l'AI SDK pour que toutes les routes appliquent la config de façon identique.
 *
 * ⚠️  CONVENTION : réglages configurables depuis le panel admin (app/admin/index.tsx),
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

/**
 * Traduit l'effort de raisonnement pour l'API OpenAI selon le modèle (pur, testé).
 *
 * La famille GPT-5.6 (sol/terra/luna) a REMPLACÉ la valeur `minimal` par `none` (doc
 * OpenAI : none/low/medium/high/xhigh/max). Envoyer `minimal` à ces modèles ferait
 * échouer l'appel (valeur de paramètre invalide) — c'est exactement le cas du chat
 * grand public, plafonné à `minimal` par `capReasoningEffort`. On garde le vocabulaire
 * interne (minimal/low/medium/high) partout — panel admin, responseMode — et on traduit
 * ICI, au bord, au moment de construire les providerOptions.
 *
 * GPT-6 n'a pas de `minimal` non plus. Sol et Luna acceptent `none` (même traduction que
 * la 5.6, donc même comportement du chat grand public) ; les autres GPT-6 (Astra) n'ont
 * pas `none` : le guide de migration OpenAI conseille alors `low`.
 */
export function openaiReasoningEffort(modelId: string, effort: ReasoningEffort): string {
  if (effort !== 'minimal') return effort;
  if (/^gpt-5\.6\b/.test(modelId)) return 'none';
  if (/^gpt-6-(?:sol|luna)\b/.test(modelId)) return 'none';
  if (/^gpt-6\b/.test(modelId)) return 'low';
  return effort;
}

/**
 * Faut-il forcer le mode « modèle à raisonnement » du SDK OpenAI ? (pur, testé)
 *
 * @ai-sdk/openai 3.0.67 reconnaît les modèles à raisonnement par leur préfixe (o1, o3,
 * o4-mini, gpt-5…) : GPT-6 lui est inconnu. Sans `forceReasoning`, il JETTE en silence
 * `reasoningEffort` (simple warning) et envoie le prompt système en rôle `system` au lieu
 * de `developer` — le chat grand public tournerait à l'effort par défaut du modèle
 * (`medium`) au lieu de `none`. Vérifié sur la requête réellement émise par le SDK
 * (tests/unit/llm-request-shape.test.ts).
 */
export function openaiNeedsForcedReasoning(modelId: string): boolean {
  return /^gpt-6\b/.test(modelId);
}

/**
 * Mode de réflexion Anthropic selon le modèle (pur, testé).
 *
 *  - `adaptive` : Claude 4.6+ et génération 5 — la profondeur se règle par `effort`
 *    (low/medium/high/xhigh/max). Le budget fixe (`thinking.type = enabled` +
 *    `budget_tokens`) est « déprécié » sur Sonnet/Opus 4.6 et REFUSÉ au-delà (Opus 4.7/4.8,
 *    Sonnet 5, Opus 5.5 — doc Anthropic « Thinking », 2026-09).
 *  - `budget` : modèles antérieurs (Haiku 4.5…), qui n'ont que la réflexion à budget fixe.
 */
export function anthropicThinkingStyle(modelId: string): 'adaptive' | 'budget' {
  if (isClaudeGeneration5(modelId)) return 'adaptive';
  if (/^claude-(?:sonnet-4-6|opus-4-[6-9])(?:-|$)/.test(modelId)) return 'adaptive';
  return 'budget';
}

/**
 * Claude génération 5 et suivantes (Sonnet 5, Opus 5.5…) — pur, testé. Leur réflexion est
 * active par défaut et le SDK installé (@ai-sdk/anthropic 3.0.81) ne les connaît pas : il
 * leur appliquerait un plafond de sortie de 4 096 tokens (réflexion comprise) et un repli
 * JSON par outil forcé que refuse Opus 5.5 (400). Voir `getRuntimeForFeature`.
 */
export function isClaudeGeneration5(modelId: string): boolean {
  return /^claude-(?:opus|sonnet|haiku|fable|mythos)-[5-9](?:-|$)/.test(modelId);
}

/** Effort Anthropic (low/medium/high) depuis le vocabulaire interne : `minimal` → `low`. */
export function anthropicEffort(effort: ReasoningEffort): 'low' | 'medium' | 'high' {
  return effort === 'minimal' ? 'low' : effort;
}

/**
 * Plafond de sortie (réflexion + réponse) pour Claude génération 5. Le SDK leur appliquerait
 * 4 096 tokens : trop peu dès que la réflexion (active par défaut) s'ajoute à un article de
 * blog ou à un JSON de CV. 64 000 reste sous le maximum documenté (128 000) ; même ordre de
 * grandeur que ce que reçoit déjà Sonnet 4.6 (128 000, défaut du SDK).
 */
export const CLAUDE_GEN5_MAX_OUTPUT_TOKENS = 64_000;

/**
 * Réserve de sortie pour la RÉFLEXION, ajoutée à un budget de sortie explicite (pur, testé).
 *
 * Chez OpenAI (API Responses) comme chez Claude en réflexion adaptative, les tokens de
 * réflexion sont décomptés du MÊME plafond que la réponse (`max_output_tokens` /
 * `max_tokens`). Le budget du mode Approfondi du chat (4 096, pensé pour la réponse
 * visible) était donc consommé en entier par une réflexion `high` avant le premier mot :
 * réponse vide, rien d'archivé, rien d'affiché. Constat en production (2026-10-01) : 6 des
 * 12 derniers appels du chatbot Pro arrêtés à exactement 4 096 tokens de sortie, sans
 * aucune réponse archivée — dont l'analyse d'image signalée par Hugo. OpenAI recommande de
 * réserver au moins 25 000 tokens à la réflexion et à la réponse (guide « Reasoning ») ;
 * gpt-6-luna accepte jusqu'à 128 000 tokens de sortie (fiche modèle OpenAI, 2026-10).
 *
 * `minimal` : aucune réflexion chez GPT-5.6/6 (`none`), quelques centaines de tokens au
 * plus ailleurs — pas de réserve, le budget du mode Rapide reste tel quel.
 */
export const REASONING_OUTPUT_RESERVE: Record<ReasoningEffort, number> = {
  minimal: 0,
  low: 4_096,
  medium: 12_288,
  high: 28_672,
};

/**
 * Tokens à réserver à la réflexion quand celle-ci partage le plafond de sortie (pur, testé).
 * 0 quand le modèle ne réfléchit pas, et pour Claude à budget fixe, dont le plancher
 * (`budget + 4 096`) est déjà posé par `resolveFeatureRuntime`.
 */
export function reasoningOutputReserve(settings: FeatureSettings, caps: { reasoning: boolean }): number {
  if (!caps.reasoning) return 0;
  if (settings.provider === 'openai') {
    // Effort non réglé : le modèle réfléchit à son effort par défaut (`medium` chez OpenAI).
    return REASONING_OUTPUT_RESERVE[settings.reasoningEffort ?? 'medium'];
  }
  if (settings.provider === 'anthropic' && anthropicThinkingStyle(settings.modelId) === 'adaptive') {
    if (settings.reasoningEffort) return REASONING_OUTPUT_RESERVE[settings.reasoningEffort];
    // Génération 5 : réflexion active par défaut, même sans effort réglé.
    return isClaudeGeneration5(settings.modelId) ? REASONING_OUTPUT_RESERVE.medium : 0;
  }
  return 0;
}

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

// Modèles Anthropic à réflexion à budget fixe (style `budget`, cf. anthropicThinkingStyle) :
// l'effort interne est mappé vers un budget de réflexion (tokens).
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
  const { settings, options } = resolveFeatureRuntime(base, overrides);
  const model = buildModel(settings.modelId, settings.provider);
  return { model, modelId: settings.modelId, provider: settings.provider, settings, options };
}

/**
 * Réglages effectifs + options d'appel à partir de la config d'une fonctionnalité (pur,
 * sans réseau, testé) : c'est ici que vivent toutes les traductions par modèle.
 */
export function resolveFeatureRuntime(
  base: FeatureSettings,
  overrides: FeatureRuntimeOverrides = {},
): { settings: FeatureSettings; options: FeatureCallOptions } {
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

  const options: FeatureCallOptions = {};
  const providerOptions: Record<string, Record<string, unknown>> = {};
  const tools: Record<string, unknown> = {};

  // Température : seulement si le modèle l'accepte.
  if (caps.temperature && settings.temperature != null) {
    options.temperature = settings.temperature;
  }

  if (settings.provider === 'openai') {
    const oai: Record<string, unknown> = {};
    if (openaiNeedsForcedReasoning(settings.modelId)) oai.forceReasoning = true;
    if (caps.reasoning && settings.reasoningEffort) {
      oai.reasoningEffort = openaiReasoningEffort(settings.modelId, settings.reasoningEffort);
    }
    if (caps.verbosity && settings.verbosity) oai.textVerbosity = settings.verbosity;
    if (Object.keys(oai).length > 0) providerOptions.openai = oai;

    if (caps.webSearch && settings.webSearch) {
      // L'API exacte de l'outil varie selon la version du provider ; on tente les
      // deux formes connues et on ignore silencieusement si indisponible.
      //
      // `searchContextSize` = quantité de contenu web injectée dans le contexte. L'audit
      // latence 2026-07 l'avait bridée à 'low' parce que la boucle agentique enchaînait
      // 3 à 5 recherches par réponse : le contenu web était alors le premier poste de
      // tokens d'entrée ET de latence. Depuis le retour à la base (ADR-0037) il n'y a plus
      // qu'UNE recherche dans UN appel, et la recherche web est devenue la SEULE source du
      // chat : 'medium' redonne au modèle de quoi citer 3-4 sources réelles plutôt que de
      // combler avec des liens devinés. Le surcoût est marginal sur gpt-6-luna
      // (0,10 $ / 1 M tokens d'entrée).
      const webSearchArgs = { searchContextSize: 'medium' as const };
      const t = openai as unknown as { tools?: Record<string, (...args: unknown[]) => unknown> };
      try {
        if (t.tools?.webSearch) tools.web_search = t.tools.webSearch(webSearchArgs);
        else if (t.tools?.webSearchPreview) tools.web_search = t.tools.webSearchPreview(webSearchArgs);
      } catch {
        /* outil indisponible dans cette version du SDK → on n'ajoute rien */
      }
    }
  } else if (settings.provider === 'anthropic') {
    const anth: Record<string, unknown> = {};
    if (caps.reasoning && settings.reasoningEffort) {
      // Anthropic exige une température non personnalisée quand la réflexion est active.
      delete options.temperature;
      if (anthropicThinkingStyle(settings.modelId) === 'adaptive') {
        // La profondeur se règle par `effort` ; le plafond de sortie par défaut du modèle
        // (ou celui posé plus bas pour la génération 5) laisse la place à la réflexion.
        anth.thinking = { type: 'adaptive' };
        anth.effort = anthropicEffort(settings.reasoningEffort);
      } else {
        const budget = ANTHROPIC_THINKING_BUDGET[settings.reasoningEffort];
        anth.thinking = { type: 'enabled', budgetTokens: budget };
        // max_tokens doit dépasser le budget de réflexion : on garantit une marge de
        // sortie suffisante (sauf override explicite plus bas).
        options.maxOutputTokens = budget + 4096;
      }
    }
    if (isClaudeGeneration5(settings.modelId)) {
      // Réflexion active par défaut, même sans effort réglé (défaut du modèle) : sans ce
      // plafond explicite, le SDK tronquerait réflexion + réponse à 4 096 tokens.
      options.maxOutputTokens = Math.max(options.maxOutputTokens ?? 0, CLAUDE_GEN5_MAX_OUTPUT_TOKENS);
      // Sorties structurées natives (`output_config.format`) pour generateObject. Le SDK ne
      // sait pas que ces modèles les prennent en charge et se replierait sur un outil `json`
      // à usage FORCÉ (`tool_choice: any`), qu'Opus 5.5 refuse sur chaque requête (400).
      anth.structuredOutputMode = 'outputFormat';
    }
    if (Object.keys(anth).length > 0) providerOptions.anthropic = anth;

    if (caps.webSearch && settings.webSearch) {
      const t = anthropic as unknown as { tools?: Record<string, (...args: unknown[]) => unknown> };
      try {
        // maxUses abaissé 5 → 3 (audit latence 2026-07) : borne le nombre de recherches
        // web du provider Anthropic, alignée sur la boucle agentique raccourcie (5 étapes).
        if (t.tools?.webSearch_20250305) tools.web_search = t.tools.webSearch_20250305({ maxUses: 3 });
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

  // Override explicite du budget de sortie (ex. mode de réponse du chat) : il porte sur la
  // RÉPONSE visible. Quand la réflexion partage ce plafond, on lui ajoute sa réserve — sans
  // quoi elle le consomme en entier et la réponse revient vide (REASONING_OUTPUT_RESERVE).
  // On respecte aussi le plancher du thinking Anthropic à budget fixe (max_tokens > budget).
  if (overrides.maxOutputTokens != null) {
    options.maxOutputTokens = Math.max(
      overrides.maxOutputTokens + reasoningOutputReserve(settings, caps),
      options.maxOutputTokens ?? 0,
    );
  }

  if (Object.keys(providerOptions).length > 0) options.providerOptions = providerOptions;
  if (Object.keys(tools).length > 0) options.tools = tools;

  return { settings, options };
}
