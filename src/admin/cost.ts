/**
 * Estimation des coûts LLM (panel admin, 2026-07).
 *
 * Source : table `ai_interactions` (colonnes `persona` = clé de feature/chatbot,
 * `model_used`, `tokens_in`, `tokens_out`, `conversation_id`). Les COMPTES DE TOKENS
 * sont des données réelles ; le COÛT est une estimation = tokens × prix du modèle.
 *
 * ⚠️ Prix INDICATIFS (USD / million de tokens), à ajuster selon ta facturation réelle.
 * Couverture complète : un prix EXACT pour les modèles courants, sinon un repli PAR
 * FAMILLE (mini/nano/pro/flash…) — le tout éditable ici. Un modèle non résolu (ex.
 * transcription Whisper facturée à la minute, pas au token) est compté 0 $ et signalé,
 * pour ne jamais afficher un total faussement bas. Module PUR, testé, sans réseau.
 */

export interface ModelPrice {
  /** USD par million de tokens d'entrée. */
  inputPerM: number;
  /** USD par million de tokens de sortie. */
  outputPerM: number;
}

export type PriceSource = 'exact' | 'family' | 'unknown';

export interface ResolvedPrice extends ModelPrice {
  source: PriceSource;
}

/** Prix EXACTS par modèle (USD / 1M tokens) — À VÉRIFIER ET AJUSTER. */
export const MODEL_PRICING: Record<string, ModelPrice> = {
  // OpenAI — flagship GPT-5.x
  'gpt-5': { inputPerM: 1.25, outputPerM: 10 },
  'gpt-5.1': { inputPerM: 1.25, outputPerM: 10 },
  'gpt-5.2': { inputPerM: 1.25, outputPerM: 10 },
  'gpt-5.4': { inputPerM: 1.25, outputPerM: 10 },
  'gpt-5.5': { inputPerM: 1.25, outputPerM: 10 },
  // OpenAI — GPT-5.6 (3 tiers, prix constatés août 2026 : sol flagship, terra équilibré,
  // luna = le plus rapide et le moins cher, après la baisse de 80 % du 30 juillet 2026).
  'gpt-5.6-sol': { inputPerM: 4, outputPerM: 20 },
  'gpt-5.6-terra': { inputPerM: 2, outputPerM: 12 },
  'gpt-5.6-luna': { inputPerM: 0.2, outputPerM: 1.2 },
  // OpenAI — GPT-4.x
  'gpt-4o': { inputPerM: 2.5, outputPerM: 10 },
  'gpt-4o-mini': { inputPerM: 0.15, outputPerM: 0.6 },
  'gpt-4.1': { inputPerM: 2, outputPerM: 8 },
  'gpt-4.1-mini': { inputPerM: 0.4, outputPerM: 1.6 },
  // Anthropic
  'claude-opus-4-8': { inputPerM: 15, outputPerM: 75 },
  'claude-sonnet-4-6': { inputPerM: 3, outputPerM: 15 },
  'claude-haiku-4-5-20251001': { inputPerM: 0.8, outputPerM: 4 },
  // Google
  'gemini-2.5-pro': { inputPerM: 1.25, outputPerM: 10 },
  'gemini-2.5-flash': { inputPerM: 0.3, outputPerM: 2.5 },
  'gemini-2.5-flash-lite': { inputPerM: 0.1, outputPerM: 0.4 },
  // Embeddings (RAG)
  'text-embedding-3-small': { inputPerM: 0.02, outputPerM: 0 },
};

/**
 * Replis PAR FAMILLE (évalués dans l'ordre) : couvrent les variantes non listées
 * explicitement (nano/mini/pro et futurs modèles) sans inventer un prix par modèle.
 */
const FAMILY_RULES: Array<{ test: RegExp; price: ModelPrice }> = [
  { test: /^text-embedding/i, price: { inputPerM: 0.02, outputPerM: 0 } },
  // Anthropic
  { test: /claude.*opus/i, price: { inputPerM: 15, outputPerM: 75 } },
  { test: /claude.*sonnet/i, price: { inputPerM: 3, outputPerM: 15 } },
  { test: /claude.*haiku/i, price: { inputPerM: 0.8, outputPerM: 4 } },
  // Google
  { test: /gemini.*flash-?lite/i, price: { inputPerM: 0.1, outputPerM: 0.4 } },
  { test: /gemini.*flash/i, price: { inputPerM: 0.3, outputPerM: 2.5 } },
  { test: /gemini.*pro/i, price: { inputPerM: 1.25, outputPerM: 10 } },
  { test: /gemini/i, price: { inputPerM: 0.3, outputPerM: 2.5 } },
  // OpenAI — variantes (l'ordre compte : nano/mini/pro avant les familles génériques)
  { test: /nano/i, price: { inputPerM: 0.05, outputPerM: 0.4 } },
  { test: /mini/i, price: { inputPerM: 0.25, outputPerM: 2 } },
  { test: /pro/i, price: { inputPerM: 15, outputPerM: 60 } },
  { test: /^o[34]/i, price: { inputPerM: 2, outputPerM: 8 } },
  { test: /gpt-4o/i, price: { inputPerM: 2.5, outputPerM: 10 } },
  { test: /gpt-4\.1/i, price: { inputPerM: 2, outputPerM: 8 } },
  // GPT-5.6 : 3 tiers aux prix TRÈS différents — placés avant la règle générique gpt-5
  // pour couvrir les variantes datées (ex. `gpt-5.6-luna-2026-xx-xx`).
  { test: /gpt-5\.6.*luna/i, price: { inputPerM: 0.2, outputPerM: 1.2 } },
  { test: /gpt-5\.6.*terra/i, price: { inputPerM: 2, outputPerM: 12 } },
  { test: /gpt-5\.6.*sol/i, price: { inputPerM: 4, outputPerM: 20 } },
  { test: /gpt-5|codex/i, price: { inputPerM: 1.25, outputPerM: 10 } },
];

/** Résout le prix d'un modèle : exact → famille → inconnu (0 $, signalé). */
export function resolveModelPrice(model: string): ResolvedPrice {
  const exact = MODEL_PRICING[model];
  if (exact) return { ...exact, source: 'exact' };
  for (const rule of FAMILY_RULES) {
    if (rule.test.test(model)) return { ...rule.price, source: 'family' };
  }
  return { inputPerM: 0, outputPerM: 0, source: 'unknown' };
}

/** Un prix (exact ou par famille) est-il défini ? (`none`, Whisper, inconnus → false). */
export function hasPricing(model: string): boolean {
  return resolveModelPrice(model).source !== 'unknown';
}

// ── Correctifs de justesse (audit coûts 2026-07, item K) ──────────────────────
//
// 1) CACHED TOKENS : `tokens_in` (= usage.inputTokens de l'AI SDK) INCLUT les tokens
//    d'entrée lus depuis le cache du provider, facturés ~10 % du prix d'entrée (OpenAI
//    prompt caching, Anthropic cache read). Les compter au plein tarif SUR-ESTIME
//    l'entrée (le gros préfixe système du chat est caché d'un appel à l'autre). On tarife
//    la part cachée au taux réduit.
// 2) WEB_SEARCH : la recherche web du provider est facturée PAR APPEL (hors tokens). On
//    connaît le nombre d'appels via `tool_calls` (migration 0034) — on l'ajoute au coût.
//    Sans ça, le chatbot pro (≈ 3-4 recherches/réponse) est SOUS-estimé.

/** Part réduite du prix d'entrée pour un token caché (OpenAI/Anthropic ≈ 10 %). INDICATIF. */
export const CACHED_INPUT_DISCOUNT = 0.1;

/** Coût INDICATIF d'un appel de recherche web, par provider (USD / appel). À AJUSTER. */
export const WEB_SEARCH_PER_CALL_USD: Record<'openai' | 'anthropic' | 'google', number> = {
  openai: 0.01, // ≈ 10 $ / 1000 appels (searchContextSize low)
  anthropic: 0.01, // ≈ 10 $ / 1000 appels
  google: 0, // grounding Google : facturation variable/incluse → compté 0, signalé
};

/** Provider déduit de l'identifiant de modèle (pour le prix par appel de recherche web). */
export function providerOfModel(model: string): 'openai' | 'anthropic' | 'google' {
  if (/claude/i.test(model)) return 'anthropic';
  if (/gemini/i.test(model)) return 'google';
  return 'openai';
}

/** Coût des appels de recherche web (web_search OpenAI/Anthropic, google_search). */
export function webSearchCostUsd(model: string, calls: number): number {
  if (!Number.isFinite(calls) || calls <= 0) return 0;
  return calls * (WEB_SEARCH_PER_CALL_USD[providerOfModel(model)] ?? 0);
}

/**
 * Coût estimé (USD) d'une ligne d'usage. 0 en tokens si prix non résolu.
 *  - `cachedTokensIn` (⊆ tokensIn) est tarifé au taux réduit CACHED_INPUT_DISCOUNT ;
 *  - `webSearchCalls` ajoute la facturation par appel de recherche web.
 * Rétro-compatible : appelé sans les deux derniers arguments = comportement d'origine.
 */
export function costUsd(
  model: string,
  tokensIn: number,
  tokensOut: number,
  cachedTokensIn = 0,
  webSearchCalls = 0,
): number {
  const p = resolveModelPrice(model);
  const cached = Math.min(Math.max(cachedTokensIn, 0), Math.max(tokensIn, 0));
  const uncached = Math.max(tokensIn, 0) - cached;
  const inputCost =
    (uncached * p.inputPerM + cached * p.inputPerM * CACHED_INPUT_DISCOUNT) / 1_000_000;
  const outputCost = (tokensOut / 1_000_000) * p.outputPerM;
  return inputCost + outputCost + webSearchCostUsd(model, webSearchCalls);
}

// ── Agrégation par feature/chatbot × modèle ───────────────────────────────────

function num(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function str(value: unknown, fallback: string): string {
  return typeof value === 'string' && value ? value : fallback;
}

/** Nombre d'appels de recherche web dans un tool_calls jsonb (web_search + google_search). */
export function webSearchCallsOf(toolCalls: unknown): number {
  if (!toolCalls || typeof toolCalls !== 'object') return 0;
  const tc = toolCalls as Record<string, unknown>;
  return num(tc.web_search) + num(tc.google_search);
}

/** Ligne brute d'usage (déjà groupée persona × modèle). */
export interface UsageRow {
  persona: string;
  model: string;
  requests: number;
  tokensIn: number;
  tokensOut: number;
  /** Part de tokensIn lue depuis le cache du provider (tarifee au taux reduit). */
  cachedTokensIn: number;
  /** Nombre d'appels de recherche web (factures par appel). */
  webSearchCalls: number;
}

export interface ModelCost extends UsageRow {
  costUsd: number;
  /** Part du cout due aux appels de recherche web (sous-ensemble de costUsd). */
  webSearchCostUsd: number;
  priced: boolean;
}

export interface ChatbotCost {
  persona: string;
  requests: number;
  tokensIn: number;
  tokensOut: number;
  cachedTokensIn: number;
  costUsd: number;
  webSearchCostUsd: number;
  models: ModelCost[];
  hasUnpriced: boolean;
}

export interface CostSummary {
  chatbots: ChatbotCost[];
  totalRequests: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCachedTokensIn: number;
  totalCostUsd: number;
  totalWebSearchCostUsd: number;
  hasUnpriced: boolean;
}

/** Groupe des lignes brutes `ai_interactions` en `UsageRow[]` (persona × modèle). */
export function groupUsage(
  raw: Array<{
    persona?: unknown;
    model_used?: unknown;
    tokens_in?: unknown;
    tokens_out?: unknown;
    cached_tokens_in?: unknown;
    tool_calls?: unknown;
  }>,
): UsageRow[] {
  const map = new Map<string, UsageRow>();
  for (const r of raw) {
    const persona = str(r.persona, 'inconnu');
    const model = str(r.model_used, 'none');
    const key = `${persona} ${model}`;
    const existing = map.get(key);
    const tokensIn = num(r.tokens_in);
    const tokensOut = num(r.tokens_out);
    const cachedTokensIn = num(r.cached_tokens_in);
    const webSearchCalls = webSearchCallsOf(r.tool_calls);
    if (existing) {
      existing.requests += 1;
      existing.tokensIn += tokensIn;
      existing.tokensOut += tokensOut;
      existing.cachedTokensIn += cachedTokensIn;
      existing.webSearchCalls += webSearchCalls;
    } else {
      map.set(key, {
        persona,
        model,
        requests: 1,
        tokensIn,
        tokensOut,
        cachedTokensIn,
        webSearchCalls,
      });
    }
  }
  return [...map.values()];
}

/** Agrège par feature/chatbot (persona), coût par modèle et total, trié par coût décroissant. */
export function aggregateCosts(rows: UsageRow[]): CostSummary {
  const byPersona = new Map<string, ChatbotCost>();

  for (const row of rows) {
    const resolved = resolveModelPrice(row.model);
    const priced = resolved.source !== 'unknown';
    const cost = costUsd(row.model, row.tokensIn, row.tokensOut, row.cachedTokensIn, row.webSearchCalls);
    const wsCost = webSearchCostUsd(row.model, row.webSearchCalls);
    const modelCost: ModelCost = { ...row, costUsd: cost, webSearchCostUsd: wsCost, priced };

    let group = byPersona.get(row.persona);
    if (!group) {
      group = {
        persona: row.persona,
        requests: 0,
        tokensIn: 0,
        tokensOut: 0,
        cachedTokensIn: 0,
        costUsd: 0,
        webSearchCostUsd: 0,
        models: [],
        hasUnpriced: false,
      };
      byPersona.set(row.persona, group);
    }
    group.requests += row.requests;
    group.tokensIn += row.tokensIn;
    group.tokensOut += row.tokensOut;
    group.cachedTokensIn += row.cachedTokensIn;
    group.costUsd += cost;
    group.webSearchCostUsd += wsCost;
    group.models.push(modelCost);
    if (!priced && row.tokensIn + row.tokensOut > 0) group.hasUnpriced = true;
  }

  const chatbots = [...byPersona.values()].sort((a, b) => b.costUsd - a.costUsd);
  for (const c of chatbots) c.models.sort((a, b) => b.costUsd - a.costUsd);

  return {
    chatbots,
    totalRequests: chatbots.reduce((s, c) => s + c.requests, 0),
    totalTokensIn: chatbots.reduce((s, c) => s + c.tokensIn, 0),
    totalTokensOut: chatbots.reduce((s, c) => s + c.tokensOut, 0),
    totalCachedTokensIn: chatbots.reduce((s, c) => s + c.cachedTokensIn, 0),
    totalCostUsd: chatbots.reduce((s, c) => s + c.costUsd, 0),
    totalWebSearchCostUsd: chatbots.reduce((s, c) => s + c.webSearchCostUsd, 0),
    hasUnpriced: chatbots.some((c) => c.hasUnpriced),
  };
}

// ── Agrégation par conversation ───────────────────────────────────────────────

/** Ligne brute au niveau conversation (persona × modèle, avec dernière activité). */
export interface ConvUsageRow {
  conversationId: string;
  persona: string;
  model: string;
  requests: number;
  tokensIn: number;
  tokensOut: number;
  cachedTokensIn: number;
  webSearchCalls: number;
  lastAt: string;
}

export interface ConvCost {
  conversationId: string;
  persona: string;
  requests: number;
  tokensIn: number;
  tokensOut: number;
  cachedTokensIn: number;
  costUsd: number;
  webSearchCostUsd: number;
  hasUnpriced: boolean;
  lastAt: string;
}

/**
 * Groupe les lignes `ai_interactions` PORTANT un `conversation_id` par conversation ×
 * modèle (une même conversation peut mêler plusieurs modèles : chat + chat_meta +
 * sous-agent). Les lignes sans `conversation_id` (features hors chat, essais anonymes)
 * sont ignorées ici — elles restent comptées dans l'agrégation globale.
 */
export function groupConversationUsage(
  raw: Array<{
    conversation_id?: unknown;
    persona?: unknown;
    model_used?: unknown;
    tokens_in?: unknown;
    tokens_out?: unknown;
    cached_tokens_in?: unknown;
    tool_calls?: unknown;
    created_at?: unknown;
  }>,
): ConvUsageRow[] {
  const map = new Map<string, ConvUsageRow>();
  for (const r of raw) {
    if (typeof r.conversation_id !== 'string' || !r.conversation_id) continue;
    const conversationId = r.conversation_id;
    const persona = str(r.persona, 'inconnu');
    const model = str(r.model_used, 'none');
    const createdAt = str(r.created_at, '');
    const key = `${conversationId} ${model}`;
    const existing = map.get(key);
    const tokensIn = num(r.tokens_in);
    const tokensOut = num(r.tokens_out);
    const cachedTokensIn = num(r.cached_tokens_in);
    const webSearchCalls = webSearchCallsOf(r.tool_calls);
    if (existing) {
      existing.requests += 1;
      existing.tokensIn += tokensIn;
      existing.tokensOut += tokensOut;
      existing.cachedTokensIn += cachedTokensIn;
      existing.webSearchCalls += webSearchCalls;
      if (createdAt > existing.lastAt) existing.lastAt = createdAt;
    } else {
      map.set(key, {
        conversationId,
        persona,
        model,
        requests: 1,
        tokensIn,
        tokensOut,
        cachedTokensIn,
        webSearchCalls,
        lastAt: createdAt,
      });
    }
  }
  return [...map.values()];
}

/** Agrège par conversation (somme des modèles), trié par coût décroissant. */
export function aggregateConversationCosts(rows: ConvUsageRow[]): ConvCost[] {
  const byConv = new Map<string, ConvCost>();
  for (const row of rows) {
    const resolved = resolveModelPrice(row.model);
    const priced = resolved.source !== 'unknown';
    const cost = costUsd(row.model, row.tokensIn, row.tokensOut, row.cachedTokensIn, row.webSearchCalls);
    const wsCost = webSearchCostUsd(row.model, row.webSearchCalls);
    let group = byConv.get(row.conversationId);
    if (!group) {
      group = {
        conversationId: row.conversationId,
        persona: row.persona,
        requests: 0,
        tokensIn: 0,
        tokensOut: 0,
        cachedTokensIn: 0,
        costUsd: 0,
        webSearchCostUsd: 0,
        hasUnpriced: false,
        lastAt: row.lastAt,
      };
      byConv.set(row.conversationId, group);
    }
    group.requests += row.requests;
    group.tokensIn += row.tokensIn;
    group.tokensOut += row.tokensOut;
    group.cachedTokensIn += row.cachedTokensIn;
    group.costUsd += cost;
    group.webSearchCostUsd += wsCost;
    if (row.lastAt > group.lastAt) group.lastAt = row.lastAt;
    if (!priced && row.tokensIn + row.tokensOut > 0) group.hasUnpriced = true;
  }
  return [...byConv.values()].sort((a, b) => b.costUsd - a.costUsd);
}
