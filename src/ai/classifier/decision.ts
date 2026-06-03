/**
 * Mapping catégorie → action de routage (01_REGULATION §4, 07_CLASSIFIER §1).
 *
 * Règle cardinale : SEUL `general_info` (avec confiance suffisante) autorise l'appel
 * du LLM principal. `personal_symptoms` / `emergency` / `ambiguous` → refus canonique,
 * LLM principal jamais appelé. `out_of_scope` → réponse polie hors-sujet (pas de refus médical).
 */
import { CANONICAL_REFUSAL } from '@/compliance/disclosures';
import type { ClassifierDecision, ClassifierResult } from './types';

/**
 * Seuil de confiance pour router une question vers le LLM principal.
 * Sous ce seuil → refus par sécurité (07_CLASSIFIER §4 : confidence < 0.85 → refus).
 */
export const GENERAL_INFO_MIN_CONFIDENCE = 0.85;

export function resolveDecision(result: ClassifierResult): ClassifierDecision {
  if (result.category === 'general_info' && result.confidence >= GENERAL_INFO_MIN_CONFIDENCE) {
    return { action: 'route_main_llm' };
  }

  if (result.category === 'out_of_scope') {
    return { action: 'out_of_scope_reply' };
  }

  // emergency | personal_symptoms | ambiguous | general_info sous le seuil → refus canonique.
  return { action: 'refuse', refusalMessage: CANONICAL_REFUSAL };
}
