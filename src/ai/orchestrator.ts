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
import { PERSONAL_MARKERS, BYPASS_MARKERS } from './classifier/lexicon';
import type { IntentCategory } from './classifier/types';


const FICTIVE_EDUCATIONAL_CASE_MARKERS: RegExp[] = [
  /cas\s+clinique\s+(fictif|p[ée]dagogique)/i,
  /cas\s+(fictif|p[ée]dagogique)\s+(edn|r2c|ecos|de\s+formation)/i,
  /(vignette|sc[ée]nario)\s+(fictive?|p[ée]dagogique|edn|r2c|ecos)/i,
  /patient\s+standardis[ée]/i,
  /entra[îi]nement\s+(edn|r2c|ecos)/i,
];

const REAL_PATIENT_CASE_MARKERS: RegExp[] = [
  /\b(patient|patiente)\s+r[ée]el(le)?\b/i,
  /\bvrai(e)?\s+(patient|patiente|cas)\b/i,
  /\b(mon|ma|notre)\s+(patient|patiente)\b/i,
  /\bcas\s+(r[ée]el|anonymis[ée]|vu\s+en\s+stage|du\s+service|du\s+cabinet)\b/i,
  /\b(en\s+stage|aux\s+urgences|dans\s+le\s+service|au\s+cabinet)\b/i,
  /\binspir[ée]e?\s+d['e]un\s+(vrai\s+)?(patient|proche|cas)\b/i,
];

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

/**
 * Exception étudiante étroite (04_CHATBOT §6) : seuls les cas explicitement fictifs
 * et pédagogiques peuvent atteindre le LLM malgré des marqueurs cliniques. La moindre
 * trace de patient réel/personnel garde le refus fail-safe.
 */
export function isExplicitFictiveEducationalCase(text: string): boolean {
  if (!matchesAny(text, FICTIVE_EDUCATIONAL_CASE_MARKERS)) return false;
  if (matchesAny(text, REAL_PATIENT_CASE_MARKERS)) return false;
  if (matchesAny(text, PERSONAL_MARKERS)) return false;
  // BYPASS_MARKERS contient volontairement « cas théorique : » ; un cas explicitement
  // fictif/pédagogique reste autorisé, mais les autres contournements demeurent bloquants.
  const blockingBypass = BYPASS_MARKERS.filter(
    (pattern) => !pattern.source.includes('cas\\s+(purement\\s+)?(th'),
  );
  if (matchesAny(text, blockingBypass)) return false;
  return true;
}

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

export type ConversationScreenOptions = ClassifierGateOptions & {
  /** Autorise uniquement les cas explicitement fictifs/pédagogiques du persona student. */
  allowFictiveEducationalCases?: boolean;
};

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
  options: ConversationScreenOptions = {},
): Promise<ConversationScreen> {
  const texts = extractUserTexts(uiMessages);

  // Requête sans aucun tour utilisateur exploitable → refus par sécurité.
  if (texts.length === 0) {
    return { allowed: false, category: 'ambiguous' };
  }

  for (const text of texts) {
    if (options.allowFictiveEducationalCases && isExplicitFictiveEducationalCase(text)) {
      continue;
    }

    const outcome = await runClassifierGate(text, options);
    if (outcome.action !== 'route_main_llm') {
      return { allowed: false, category: outcome.category };
    }
  }

  return { allowed: true, category: 'general_info' };
}
