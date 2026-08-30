/**
 * Mode de réponse du chat — choix utilisateur, par requête.
 *
 * L'utilisateur choisit la « profondeur » de la réponse :
 *   - `fast`     : réponse instantanée, brève, SANS recherche web (de mémoire).
 *   - `standard` : comportement par défaut (config admin de la feature `chat`).
 *   - `deep`     : réponse complète et approfondie (plus d'effort, plus de détail).
 *
 * Retour à la base (2026-08, ADR-0037) : les 3 modes empruntent désormais le MÊME chemin
 * — un seul appel LLM sur la feature `chat`. Il n'y a plus de boucle agentique à borner
 * (`maxSteps`), plus de modèle séparé pour le mode rapide, plus de garde anti-réponse-vide :
 * le mode ne règle que l'effort de raisonnement, la verbosité, le budget de sortie et
 * l'activation de la recherche web.
 *
 * Module PUR (server-safe, aucune dépendance réseau, aucune donnée de santé). Les
 * surcharges priment sur la config admin pour CETTE requête uniquement
 * (cf. FeatureRuntimeOverrides).
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
 * Surcharges runtime dérivées du mode. Les champs absents laissent la config admin
 * s'appliquer (mode `standard`).
 */
export interface ResponseModeRuntime {
  /** Fixe explicitement l'effort (fast/deep) ; absent = config admin. */
  reasoningEffort?: ReasoningEffort | null;
  /** Plafond d'effort (jamais relevé) — cloisonnement coût du grand public. */
  capReasoningEffort?: ReasoningEffort;
  verbosity?: Verbosity | null;
  maxOutputTokens?: number;
  /**
   * Recherche web du provider. `false` en mode rapide seulement : la réponse est alors
   * donnée de mémoire, et la consigne du mode interdit explicitement toute source (le
   * modèle n'a rien pour la vérifier). Absent = laissée à la config admin de `chat`.
   */
  webSearch?: boolean;
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
    // Aucune recherche : la latence est celle d'un unique aller-retour sans outil.
    // Le budget de sortie doit rester confortable — sur les modèles à raisonnement,
    // les tokens de réflexion sont décomptés du même budget : trop bas, la réponse
    // revient vide et l'utilisateur voit « la réponse a peut-être été interrompue ».
    return {
      reasoningEffort: 'minimal',
      verbosity: 'low',
      maxOutputTokens: 3000,
      webSearch: false,
    };
  }

  if (mode === 'deep') {
    return isPublic
      ? { capReasoningEffort: 'medium', verbosity: 'high', maxOutputTokens: 4096 }
      : { reasoningEffort: 'high', verbosity: 'high', maxOutputTokens: 4096 };
  }

  // standard : config admin telle quelle, à un détail près — le grand public reste
  // plafonné à un effort de raisonnement `minimal` (cloisonnement coût historique).
  return isPublic ? { capReasoningEffort: 'minimal' } : {};
}

/**
 * Courte consigne concaténée au system prompt pour aligner la LONGUEUR/PROFONDEUR sur
 * le mode choisi. Subordonnée au format imposé par les prompts produit (elle ajuste la
 * densité, ne remplace jamais la structure exigée). Vide en mode `standard`.
 */
export function buildResponseModeSection(mode: ResponseMode): string {
  if (mode === 'fast') {
    // ⚠️ En mode rapide, le modèle n'a PAS de recherche web : il répond de mémoire. La
    // consigne doit donc lui interdire explicitement de produire des sources qu'il ne peut
    // pas vérifier, et porter le cadrage de sécurité correspondant.
    return (
      `\n\nMODE DE RÉPONSE : RAPIDE\n` +
      `Tu réponds SANS recherche web. ` +
      `Va droit au but — l'essentiel en quelques phrases, sans développement superflu ` +
      `ni longues sections.\n` +
      `RÈGLES ABSOLUES DE CE MODE :\n` +
      `- N'invente JAMAIS d'URL, de référence, de titre d'étude ni de numéro NCT. ` +
      `Ne produis PAS de section SOURCES : tu n'as rien vérifié.\n` +
      `- N'invente JAMAIS un chiffre (posologie, seuil, incidence). Si un chiffre précis ` +
      `ou une source à jour est nécessaire, dis-le en une phrase et invite à relancer la ` +
      `question en mode Classique ou Approfondi, qui effectue une recherche web.\n` +
      `- Toute équivalence de doses reste INDICATIVE et doit être validée par le ` +
      `prescripteur selon le RCP et le contexte ; signale les points de sécurité majeurs ` +
      `(marge thérapeutique étroite, insuffisance rénale/hépatique, grossesse, interactions).\n` +
      `- Les consignes de sécurité et d'orientation de tes instructions principales ` +
      `s'appliquent intégralement : la brièveté ne les suspend jamais.`
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
