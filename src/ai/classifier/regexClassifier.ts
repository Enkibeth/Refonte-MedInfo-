/**
 * Étage 1 — classifieur regex déterministe, local, <5 ms, gratuit (07_CLASSIFIER §2).
 *
 * Renvoie `null` quand aucune règle ne tranche : la décision revient alors à
 * l'étage 2 (LLM léger) s'il est injecté, sinon au fail-safe `ambiguous`.
 */
import {
  BYPASS_MARKERS,
  EMERGENCY_MARKERS,
  GENERAL_INFO_MARKERS,
  OUT_OF_SCOPE_MARKERS,
  PERSONAL_MARKERS,
} from './lexicon';
import type { ClassifierResult } from './types';

const REGEX_CONFIDENCE = {
  emergency: 0.99,
  personal_symptoms: 0.97,
  general_info: 0.9,
  out_of_scope: 0.9,
} as const;

function firstMatch(message: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const m = message.match(pattern);
    if (m) return m[0];
  }
  return null;
}

export function classifyByRegex(message: string): ClassifierResult | null {
  const text = message.trim();
  if (text.length === 0) return null;

  // Ordre imposé par l'asymétrie sécurité : urgence d'abord, puis personnel.
  const emergency = firstMatch(text, EMERGENCY_MARKERS);
  if (emergency) {
    return {
      category: 'emergency',
      confidence: REGEX_CONFIDENCE.emergency,
      layer: 'regex',
      matchedMarkers: [emergency],
    };
  }

  const bypass = firstMatch(text, BYPASS_MARKERS);
  const personal = firstMatch(text, PERSONAL_MARKERS);
  if (bypass || personal) {
    return {
      category: 'personal_symptoms',
      confidence: REGEX_CONFIDENCE.personal_symptoms,
      layer: 'regex',
      matchedMarkers: [bypass, personal].filter((m): m is string => m !== null),
    };
  }

  // general_info uniquement si tournure encyclopédique claire ET aucun marqueur personnel
  // (déjà écarté ci-dessus) — ceinture + bretelles.
  const general = firstMatch(text, GENERAL_INFO_MARKERS);
  if (general) {
    return {
      category: 'general_info',
      confidence: REGEX_CONFIDENCE.general_info,
      layer: 'regex',
      matchedMarkers: [general],
    };
  }

  const outOfScope = firstMatch(text, OUT_OF_SCOPE_MARKERS);
  if (outOfScope) {
    return {
      category: 'out_of_scope',
      confidence: REGEX_CONFIDENCE.out_of_scope,
      layer: 'regex',
      matchedMarkers: [outOfScope],
    };
  }

  return null;
}
