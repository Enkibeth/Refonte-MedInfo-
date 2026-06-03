/**
 * Logging ai_interactions — service_role only (03_SECURITY §6).
 * Aucune donnée santé identifiable : pas de contenu de message.
 * Utilisé par la route API chat pour chaque interaction (refus ou réponse).
 */
import { createClient } from '@supabase/supabase-js';

import type { IntentCategory } from '@/ai/classifier/types';
import type { Persona } from '@/ai/prompts/_schema';

export type GuardrailLayer = 'classifier' | 'prompt' | 'output_validation' | 'none';

export interface InteractionLog {
  user_id?: string;
  persona: Persona;
  model_used: string;
  tokens_in?: number;
  tokens_out?: number;
  latency_ms?: number;
  refusal_triggered: boolean;
  guardrail_layer: GuardrailLayer;
  intent_category: IntentCategory;
}

export async function logInteraction(entry: InteractionLog): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    // En dev sans Supabase configuré, on log seulement en console.
    console.warn('[logInteraction] Supabase service role not configured — skipping DB log.', entry);
    return;
  }

  try {
    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });

    const { error } = await supabase.from('ai_interactions').insert(entry);
    if (error) {
      console.error('[logInteraction] Insert failed:', error.message);
    }
  } catch (err) {
    console.error('[logInteraction] Unexpected error:', err);
  }
}
