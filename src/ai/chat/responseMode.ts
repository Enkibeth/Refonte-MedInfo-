/**
 * Mode de réponse du chat (2026-07) — choix utilisateur, par requête.
 *
 * L'utilisateur choisit la « profondeur » de la réponse, indépendamment du mode de
 * raisonnement technique :
 *   - `fast`     : réponse instantanée, brève et directe (peu d'étapes d'outils).
 *   - `standard` : comportement par défaut (config admin de la feature `chat`).
 *   - `deep`     : réponse complète et approfondie (plus d'étapes, plus de détail).
 *
 * Module PUR (server-safe, aucune dépendance réseau, aucune donnée de santé) : il ne
 * fait que MAPPER le mode vers des surcharges runtime (effort de raisonnement, verbosité,
 * budget de sortie) et un plafond d'étapes de la boucle agentique. Les surcharges
 * priment sur la config admin pour CETTE requête uniquement (cf. FeatureRuntimeOverrides).
 *
 * Cloisonnement coût : le grand public reste plafonné (le mode `deep` y ouvre au plus un
 * effort `medium`, jamais `high`) ; étudiant/pro peuvent monter plus haut.
 */
import type { ChatbotId } from '@/ai/chat/chatContext';
import type { ReasoningEffort, Verbosity } from '@/ai/providers/featureModel';

export type ResponseMode = 'fast' | 'standard' | 'deep';

export const RESPONSE_MODES: ResponseMode[] = ['fast', 'standard', 'deep'];

/** Valeur par défaut (comportement historique du chat). */
export const DEFAULT_RESPONSE_MODE: ResponseMode = 'standard';

export function coerceResponseMode(value: unknown): ResponseMode {
  return RESPONSE_MODES.includes(value as ResponseMode)
    ? (value as ResponseMode)
    : DEFAULT_RESPONSE_MODE;
}

/**
 * Surcharges runtime dérivées du mode. `maxSteps` borne la boucle agentique
 * (`stopWhen: stepCountIs`) — le plus gros levier de latence. Les champs absents
 * laissent la config admin s'appliquer (mode `standard`).
 */
export interface ResponseModeRuntime {
  /** Fixe explicitement l'effort (fast/deep) ; absent = config admin. */
  reasoningEffort?: ReasoningEffort | null;
  /** Plafond d'effort (jamais relevé) — cloisonnement coût du grand public. */
  capReasoningEffort?: ReasoningEffort;
  verbosity?: Verbosity | null;
  maxOutputTokens?: number;
  /** Plafond d'étapes de la boucle agentique (stepCountIs). */
  maxSteps: number;
}

/**
 * Mappe (mode, chatbot) → surcharges runtime.
 *
 * Grand public : `standard` conserve le plafond historique `minimal` (ancrage factuel
 * par les outils, pas par le thinking) ; `deep` ouvre jusqu'à `medium`. Étudiant/pro :
 * `standard` = config admin telle quelle ; `deep` = `high`.
 */
export function responseModeRuntime(
  mode: ResponseMode,
  chatbot: ChatbotId,
): ResponseModeRuntime {
  const isPublic = chatbot === 'public';

  if (mode === 'fast') {
    return {
      reasoningEffort: 'minimal',
      verbosity: 'low',
      maxOutputTokens: 1400,
      maxSteps: 4,
    };
  }

  if (mode === 'deep') {
    return isPublic
      ? { capReasoningEffort: 'medium', verbosity: 'high', maxOutputTokens: 4096, maxSteps: 8 }
      : { reasoningEffort: 'high', verbosity: 'high', maxOutputTokens: 4096, maxSteps: 8 };
  }

  // standard : plafond abaissé à 5 étapes (audit latence 2026-07). Les données de prod
  // montraient une latence linéaire dans le nombre d'étapes (~15-18 s/étape) SANS gain de
  // qualité au-delà de ~5 : le workflow evidence-first tient en 5 étapes (recherche →
  // lecture des résumés → vérification des liens → rédaction). Public toujours plafonné
  // à un effort de raisonnement `minimal` (ancrage factuel par les outils, pas le thinking).
  return isPublic
    ? { capReasoningEffort: 'minimal', maxSteps: 5 }
    : { maxSteps: 5 };
}

/**
 * Courte consigne concaténée au system prompt pour aligner la LONGUEUR/PROFONDEUR sur
 * le mode choisi. Subordonnée au format imposé par les prompts produit (elle ajuste la
 * densité, ne remplace jamais la structure exigée). Vide en mode `standard`.
 */
export function buildResponseModeSection(mode: ResponseMode): string {
  if (mode === 'fast') {
    return (
      `\n\nMODE DE RÉPONSE : RAPIDE\n` +
      `Va droit au but : l'essentiel en quelques phrases, sans développement superflu. ` +
      `Limite-toi à l'information la plus utile ; n'ouvre pas de longues sections. ` +
      `Reste dans le format exigé par tes consignes, en version condensée.`
    );
  }
  if (mode === 'deep') {
    return (
      `\n\nMODE DE RÉPONSE : APPROFONDI\n` +
      `Développe une réponse complète et structurée : explicite le raisonnement, les ` +
      `nuances, les cas particuliers et les limites, en respectant le format exigé par ` +
      `tes consignes. N'invente jamais de fait ni de source pour étoffer.`
    );
  }
  return '';
}
