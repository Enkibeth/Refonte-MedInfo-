/**
 * Étage 1 de la garde d'entrée — classifieur regex déterministe, local, <5 ms,
 * gratuit (repris de l'ancienne safe-box, ea616fc, ADR-0029).
 *
 * Renvoie `null` quand aucune règle ne tranche : contrairement à l'ancien
 * classifieur (fail-safe ambiguous → refus), la nouvelle politique ROUTE ce cas
 * vers le LLM principal (décision ADR-0029, anti sur-refus).
 */
import {
  BYPASS_MARKERS,
  EMERGENCY_MARKERS,
  GENERAL_INFO_MARKERS,
  OUT_OF_SCOPE_MARKERS,
  PERSONAL_MARKERS,
} from './lexicon';
import type { RegexGuardResult } from './types';

function firstMatch(message: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const m = message.match(pattern);
    if (m) return m[0];
  }
  return null;
}

/**
 * Les claviers mobiles produisent l'apostrophe typographique ’ (U+2019) que les
 * classes `['e]` du lexique ne matchent pas — trou détecté par simulation
 * (ADR-0029) : « Dis-moi ce que j’ai » passait, « Dis-moi ce que j'ai » bloquait.
 */
export function normalizeApostrophes(text: string): string {
  return text.replace(/[’‘]/g, "'");
}

export function classifyByRegex(message: string): RegexGuardResult | null {
  const text = normalizeApostrophes(message).trim();
  if (text.length === 0) return null;

  // Ordre imposé par l'asymétrie sécurité : urgence d'abord, puis personnel.
  const emergency = firstMatch(text, EMERGENCY_MARKERS);
  if (emergency) return { category: 'emergency', matchedMarker: emergency };

  const bypass = firstMatch(text, BYPASS_MARKERS);
  const personal = firstMatch(text, PERSONAL_MARKERS);
  if (bypass || personal) {
    return { category: 'personal_symptoms', matchedMarker: (bypass ?? personal)! };
  }

  const general = firstMatch(text, GENERAL_INFO_MARKERS);
  if (general) return { category: 'general_info', matchedMarker: general };

  const outOfScope = firstMatch(text, OUT_OF_SCOPE_MARKERS);
  if (outOfScope) return { category: 'out_of_scope', matchedMarker: outOfScope };

  return null;
}
