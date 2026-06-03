/**
 * Couche 3 du safe-box : validation de sortie LLM (03_SECURITY §5, 04_CHATBOT §4).
 * Bloque toute réponse contenant des marqueurs de diagnostic individualisé,
 * même en cas de jailbreak partiel (01_REGULATION §4).
 * Appelé dans onFinish de streamText — ne modifie pas le flux, remplace la réponse.
 */
import { CANONICAL_REFUSAL } from '@/compliance/disclosures';

export type OutputValidationResult =
  | { blocked: false }
  | { blocked: true; reason: string; blockedMessage: string };

const DIAGNOSTIC_MARKERS: RegExp[] = [
  /vous avez probablement/i,
  /vous souffrez de/i,
  /vous êtes atteint/i,
  /votre maladie est/i,
  /votre diagnostic(?: est)?/i,
  /il s'agit probablement de votre/i,
];

export function validateOutput(text: string): OutputValidationResult {
  for (const pattern of DIAGNOSTIC_MARKERS) {
    if (pattern.test(text)) {
      return {
        blocked: true,
        reason: `Marqueur diagnostique individualisé détecté : "${pattern.source}"`,
        blockedMessage: CANONICAL_REFUSAL,
      };
    }
  }
  return { blocked: false };
}
