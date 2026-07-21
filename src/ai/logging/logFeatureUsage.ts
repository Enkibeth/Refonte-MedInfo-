/**
 * Helper d'instrumentation coût pour TOUTES les routes IA (2026-07).
 *
 * Chaque route IA (chat, chat_meta, analyse, ECOS, audio, présentation, CV, article,
 * QCM, révision, sous-agent PubMed…) appelle ce helper après son appel LLM pour
 * archiver, dans `ai_interactions`, la feature (`persona`), le modèle et les compteurs
 * de tokens — jamais de contenu de message. Objectif : un tableau de coûts admin
 * COMPLET (tous les modèles), pas seulement le chat.
 *
 * Fire-and-forget : ne jette jamais et n'attend rien (le logging ne doit jamais
 * casser ni ralentir une réponse). Normalise les différentes formes d'objet `usage`
 * de l'AI SDK (inputTokens/outputTokens ou promptTokens/completionTokens).
 */
import { logInteraction, type IntentCategory } from '@/ai/logging/logInteraction';

interface UsageLike {
  inputTokens?: number | null;
  outputTokens?: number | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
}

export interface FeatureUsageEntry {
  /** Clé de feature (ex. 'analyze', 'chat_meta') ou chatbot ('public'…). */
  feature: string;
  modelId: string;
  usage?: UsageLike | null;
  userId?: string | null;
  latencyMs?: number;
  conversationId?: string | null;
  /** Défaut 'general_info' (aucune classification d'intention côté serveur). */
  intent?: IntentCategory;
}

function toCount(...vals: Array<number | null | undefined>): number | undefined {
  for (const v of vals) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return undefined;
}

/** Archive l'usage d'une feature IA (non bloquant). */
export function logFeatureUsage(entry: FeatureUsageEntry): void {
  void logInteraction({
    persona: entry.feature,
    model_used: entry.modelId,
    tokens_in: toCount(entry.usage?.inputTokens, entry.usage?.promptTokens),
    tokens_out: toCount(entry.usage?.outputTokens, entry.usage?.completionTokens),
    latency_ms: entry.latencyMs,
    conversation_id: entry.conversationId ?? undefined,
    user_id: entry.userId ?? undefined,
    refusal_triggered: false,
    guardrail_layer: 'none',
    intent_category: entry.intent ?? 'general_info',
  });
}
