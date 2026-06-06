/**
 * Classifieur d'intention — point d'entrée (couche 1 du safe-box).
 *
 * Pipeline (07_CLASSIFIER §2) :
 *   1. Étage 1 regex déterministe (local, gratuit). S'il tranche → résultat.
 *   2. Étage 2 LLM léger SI injecté. NON câblé à l'étape 2 du projet (interface only).
 *   3. Fail-safe : aucun étage ne tranche → `ambiguous` (refus par défaut, 07_CLASSIFIER §1).
 *
 * Ceinture + bretelles : un verdict `general_info` rendu par l'étage 2 est rétrogradé
 * en `personal_symptoms` si un marqueur personnel regex matche malgré tout (07_CLASSIFIER §4).
 */
import { classifyByRegex } from './regexClassifier';
import { BYPASS_MARKERS, PERSONAL_MARKERS } from './lexicon';
import type { ClassifierResult, LlmStage2 } from './types';

export type ClassifyOptions = {
  /** Étage 2 (LLM léger) injectable. Absent à l'étape 2 du projet → fail-safe ambiguous. */
  llmStage2?: LlmStage2;
};

const FALLBACK_AMBIGUOUS: ClassifierResult = {
  category: 'ambiguous',
  confidence: 0,
  layer: 'fallback',
};

function hasPersonalMarker(message: string): boolean {
  return [...PERSONAL_MARKERS, ...BYPASS_MARKERS].some((p) => p.test(message));
}

export async function classifyIntent(
  message: string,
  options: ClassifyOptions = {},
): Promise<ClassifierResult> {
  const regex = classifyByRegex(message);
  if (regex) return regex;

  if (options.llmStage2) {
    const verdict = await options.llmStage2(message);
    // Bretelles : ne jamais accepter un general_info LLM si un marqueur personnel subsiste.
    if (verdict.category === 'general_info' && hasPersonalMarker(message)) {
      return { category: 'personal_symptoms', confidence: 0.97, layer: 'llm' };
    }
    return { category: verdict.category, confidence: verdict.confidence, layer: 'llm' };
  }

  return FALLBACK_AMBIGUOUS;
}

export { classifyByRegex } from './regexClassifier';
export { resolveDecision, GENERAL_INFO_MIN_CONFIDENCE } from './decision';
export { runClassifierGate } from './gate';
export type {
  IntentCategory,
  ClassifierLayer,
  ClassifierResult,
  ClassifierAction,
  ClassifierDecision,
  LlmStage2,
} from './types';
