/**
 * Logging ai_interactions — service_role only (03_SECURITY §6).
 * Aucune donnée santé identifiable : pas de contenu de message.
 * Utilisé par les routes API IA (chat + autres features) pour chaque interaction.
 */
import { createServerSupabaseClient } from '@/db/serverSupabase';

export type GuardrailLayer = 'classifier' | 'prompt' | 'output_validation' | 'rag_cite_or_refuse' | 'none';

/** Catégorie d'intention (héritée du schéma ai_interactions ; classifieur retiré, refonte 2026-06). */
export type IntentCategory =
  | 'general_info'
  | 'personal_symptoms'
  | 'emergency'
  | 'medication_dosage'
  | 'educational_case'
  | 'ambiguous';

export interface InteractionLog {
  user_id?: string;
  /** Chatbot (public/student/professional) OU clé de feature (analyze, chat_meta…). */
  persona: string;
  model_used: string;
  /** Conversation chat associée (coût par conversation) — absent hors chat. */
  conversation_id?: string;
  tokens_in?: number;
  tokens_out?: number;
  latency_ms?: number;
  /** Nombre d'étapes LLM de la boucle agentique (diagnostic latence, migration 0034). */
  steps?: number;
  /** Décompte d'appels par nom d'outil — jamais leurs arguments (migration 0034). */
  tool_calls?: Record<string, number>;
  refusal_triggered: boolean;
  guardrail_layer: GuardrailLayer;
  intent_category: IntentCategory;
}

export async function logInteraction(entry: InteractionLog): Promise<void> {
  const supabase = createServerSupabaseClient();

  if (!supabase) {
    // En dev sans Supabase configuré, on log seulement en console.
    console.warn('[logInteraction] Supabase service role not configured — skipping DB log.', entry);
    return;
  }

  try {
    const { error } = await supabase.from('ai_interactions').insert(entry);
    if (error) {
      console.error('[logInteraction] Insert failed:', error.message);
    }
  } catch (err) {
    console.error('[logInteraction] Unexpected error:', err);
  }
}
