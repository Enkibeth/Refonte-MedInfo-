/**
 * Point d'accès unique au flux IA (02_ARCHITECTURE §3).
 *
 * L'orchestrateur porte la couche 1 du safe-box : AUCUN message ne peut atteindre le
 * LLM principal sans avoir été classifié ici au préalable. La route API
 * (`app/api/chat+api.ts`) délègue à `screenConversation` AVANT d'appeler le LLM, puis
 * applique la couche 3 (validation de sortie) et journalise dans `ai_interactions`.
 *
 * Durcissement audit (I1) : on ne fait JAMAIS confiance à l'historique fourni par le
 * client. CHAQUE tour utilisateur de la conversation est reclassifié — pas seulement le
 * dernier — pour empêcher un historique forgé d'introduire des symptômes personnels dans
 * le contexte du LLM sans passer par la couche 1.
 */
import { runClassifierGate, type ClassifierGateOptions, type ClassifierGateOutcome } from './classifier/gate';
import type { IntentCategory } from './classifier/types';

export async function medInfoOrchestrator(
  message: string,
  options: ClassifierGateOptions = {},
): Promise<ClassifierGateOutcome> {
  return runClassifierGate(message, options);
}

/** Extrait le texte de chaque message `user` (string `content` ou première part texte). */
export function extractUserTexts(uiMessages: unknown[]): string[] {
  return (Array.isArray(uiMessages) ? uiMessages : [])
    .filter((m): m is Record<string, any> => !!m && (m as any).role === 'user')
    .map((m) => {
      if (typeof m.content === 'string') return m.content;
      const textPart = Array.isArray(m.parts)
        ? m.parts.find((p: any) => p?.type === 'text')
        : undefined;
      return typeof textPart?.text === 'string' ? textPart.text : '';
    });
}

export type ConversationScreen = {
  /** true uniquement si TOUS les tours utilisateur sont routables vers le LLM principal. */
  allowed: boolean;
  /** Catégorie du premier tour bloquant (sinon `general_info`). */
  category: IntentCategory;
};

/**
 * Couche 1 appliquée à toute la conversation. Le LLM principal n'est autorisé que si
 * chaque tour utilisateur est classé `general_info` (avec confiance suffisante). Le
 * moindre tour `personal_symptoms` / `emergency` / `ambiguous` / `out_of_scope` (ou un
 * tour vide) → refus déterministe, LLM jamais appelé.
 */
export async function screenConversation(
  uiMessages: unknown[],
  options: ClassifierGateOptions = {},
): Promise<ConversationScreen> {
  const texts = extractUserTexts(uiMessages);

  // Requête sans aucun tour utilisateur exploitable → refus par sécurité.
  if (texts.length === 0) {
    return { allowed: false, category: 'ambiguous' };
  }

  for (const text of texts) {
    const outcome = await runClassifierGate(text, options);
    if (outcome.action !== 'route_main_llm') {
      return { allowed: false, category: outcome.category };
    }
  }

  return { allowed: true, category: 'general_info' };
}
