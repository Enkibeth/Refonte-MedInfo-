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
  /**
   * Réponse DIRECTE (mode rapide) : UN SEUL appel LLM sur un modèle bon marché, sans
   * aucun outil, sans split orchestrateur/rédacteur et sans recherche web. Corrige le
   * paradoxe du mode « rapide » d'origine, qui enchaînait DEUX modèles (chercheur puis
   * rédacteur) et était donc le chemin le PLUS LENT, avec un budget de sortie si serré
   * (1400 tokens, raisonnement inclus) que la réponse pouvait revenir vide.
   */
  directAnswer?: boolean;
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
    // Un seul appel, aucun outil : la latence est celle d'un unique aller-retour.
    // Le budget de sortie doit rester confortable — sur les modèles à raisonnement,
    // les tokens de réflexion sont décomptés du même budget : trop bas, la réponse
    // revient vide et l'utilisateur voit « la réponse a peut-être été interrompue ».
    return {
      reasoningEffort: 'minimal',
      verbosity: 'low',
      maxOutputTokens: 3000,
      maxSteps: 1,
      directAnswer: true,
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
 * Garde anti-réponse-vide (incident prod 2026-07-28) : avec le plafond d'étapes abaissé
 * (audit latence, 12 → 5), le modèle pouvait dépenser TOUTES ses étapes en appels d'outils
 * (jusqu'à 8 web_search + Europe PMC + vérifications observés dans ai_interactions) et se
 * faire couper par `stopWhen: stepCountIs(maxSteps)` AVANT d'écrire le moindre mot : flux
 * HTTP 200 « propre », zéro texte, rien d'archivé — l'utilisateur voyait « rien n'est
 * généré » puis « la réponse a été interrompue » au retour dans l'app.
 *
 * Ce `prepareStep` force la DERNIÈRE étape autorisée à être une étape de RÉDACTION pure
 * (`toolChoice: 'none'`) : le modèle ne peut plus finir sur un appel d'outil, il répond
 * avec ce qu'il a rassemblé. Appliqué au rédacteur ET à l'agent chercheur (un chercheur
 * coupé en plein outil rendait un dossier vide → repli mono-modèle silencieux qui refaisait
 * toute la recherche… et se faisait couper à son tour).
 */
export interface ForcedAnswerStep {
  toolChoice?: 'none';
}

export function forceFinalAnswerStep(maxSteps: number) {
  const lastStep = Math.max(0, Math.floor(maxSteps) - 1);
  return ({ stepNumber }: { stepNumber: number }): ForcedAnswerStep =>
    stepNumber >= lastStep ? { toolChoice: 'none' } : {};
}

/**
 * Courte consigne concaténée au system prompt pour aligner la LONGUEUR/PROFONDEUR sur
 * le mode choisi. Subordonnée au format imposé par les prompts produit (elle ajuste la
 * densité, ne remplace jamais la structure exigée). Vide en mode `standard`.
 */
export function buildResponseModeSection(mode: ResponseMode): string {
  if (mode === 'fast') {
    // ⚠️ En mode rapide, le modèle n'a NI recherche web NI outil de vérification de
    // liens : il répond de mémoire. La consigne doit donc lui interdire explicitement
    // de produire des sources qu'il ne peut pas vérifier, et porter le cadrage de
    // sécurité que le volet pharmacologie (couplé au workflow d'outils) n'apporte pas ici.
    return (
      `\n\nMODE DE RÉPONSE : RAPIDE\n` +
      `Tu réponds SANS recherche : ni web, ni littérature, ni vérification de liens. ` +
      `Va droit au but — l'essentiel en quelques phrases, sans développement superflu ` +
      `ni longues sections.\n` +
      `RÈGLES ABSOLUES DE CE MODE :\n` +
      `- N'invente JAMAIS d'URL, de référence, de titre d'étude ni de numéro NCT. ` +
      `Ne produis PAS de section SOURCES : tu n'as rien vérifié.\n` +
      `- N'invente JAMAIS un chiffre (posologie, seuil, incidence). Si un chiffre précis ` +
      `ou une source à jour est nécessaire, dis-le en une phrase et invite à relancer la ` +
      `question en mode Classique ou Approfondi, qui recherche et vérifie ses sources.\n` +
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
