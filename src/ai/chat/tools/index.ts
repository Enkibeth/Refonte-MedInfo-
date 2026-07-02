/**
 * Outils qualité du chat (refonte agents 2026-07, ADR-0030).
 *
 * Le modèle du chat devient l'orchestrateur d'une boucle agentique : il délègue à des
 * outils serveur déterministes (sous-agents) la recherche bibliographique réelle
 * (Europe PMC), la recherche d'essais cliniques (ClinicalTrials.gov, chatbot pro) et
 * la vérification des liens sources avant rédaction — objectif : qualité et
 * vérifiabilité des réponses, jamais une couche de régulation.
 *
 * Aucune nouvelle feature IA admin : ces outils sont des appels REST déterministes
 * exécutés au sein de la feature `chat` (aucun appel LLM supplémentaire).
 */
import type { ChatbotId } from '@/ai/chat/chatContext';
import { europePmcSearchTool } from './europePmc';
import { clinicalTrialsSearchTool } from './clinicalTrials';
import { verifySourceLinksTool } from './verifyLinks';

export { buildEuropePmcSearchUrl, formatEuropePmcResults } from './europePmc';
export { buildClinicalTrialsSearchUrl, formatClinicalTrialsResults } from './clinicalTrials';
export {
  formatLinkCheckResults,
  verdictForHttpStatus,
  MAX_URLS_PER_CALL,
  type LinkCheckResult,
  type LinkCheckStatus,
} from './verifyLinks';
export { isSafePublicHttpUrl } from './urlSafety';

/** Noms d'outils exposés — utilisés aussi par le client pour la bulle de statut. */
export const CHAT_TOOL_NAMES = {
  europePmc: 'europe_pmc_search',
  clinicalTrials: 'clinical_trials_search',
  verifyLinks: 'verify_source_links',
} as const;

/**
 * Outils disponibles selon le chatbot :
 *  - les 3 chatbots : recherche bibliographique + vérification des liens ;
 *  - professionnel : + essais cliniques (« essais en cours » = demande de cliniciens).
 */
export function buildChatTools(
  chatbot: ChatbotId,
  fetchImpl: typeof fetch = fetch,
): Record<string, unknown> {
  const tools: Record<string, unknown> = {
    [CHAT_TOOL_NAMES.europePmc]: europePmcSearchTool(fetchImpl),
    [CHAT_TOOL_NAMES.verifyLinks]: verifySourceLinksTool(fetchImpl),
  };
  if (chatbot === 'professional') {
    tools[CHAT_TOOL_NAMES.clinicalTrials] = clinicalTrialsSearchTool(fetchImpl);
  }
  return tools;
}

/**
 * Section « outils de fiabilisation » concaténée au system prompt (comme le contexte
 * utilisateur) : les prompts produit de Hugo restent la source de vérité du
 * comportement, cette section explique seulement QUAND déléguer aux outils.
 */
export function buildChatToolsSection(chatbot: ChatbotId): string {
  const lines = [
    `- ${CHAT_TOOL_NAMES.europePmc} : littérature biomédicale réelle (PubMed/Europe PMC : auteurs, journal, année, DOI, citations). À utiliser dès que tu cites une étude — ne cite jamais un article que tu n'as pas retrouvé par cet outil ou la recherche web.`,
  ];
  if (chatbot === 'professional') {
    lines.push(
      `- ${CHAT_TOOL_NAMES.clinicalTrials} : essais cliniques enregistrés (ClinicalTrials.gov : NCT, statut, phase). À utiliser pour toute question sur les essais en cours ou les thérapies émergentes — n'invente jamais un NCT ni un statut de recrutement.`,
    );
  }
  lines.push(
    `- ${CHAT_TOOL_NAMES.verifyLinks} : vérifie que des URLs répondent réellement. Appelle-le UNE SEULE fois, juste avant de rédiger la section SOURCES, avec toutes les URLs que tu prévois de citer ; remplace toute URL cassée (DOI, page officielle de niveau supérieur) ou retire la source.`,
  );

  return (
    `\n\nOUTILS DE FIABILISATION (serveur MedInfo)\n` +
    `En complément de la recherche web, tu disposes d'outils dédiés pour fiabiliser tes réponses :\n` +
    `${lines.join('\n')}\n` +
    `Ces outils ne changent RIEN au format de réponse exigé par tes consignes ; n'affiche jamais leurs sorties brutes et ne mentionne pas leur existence à l'utilisateur.`
  );
}
