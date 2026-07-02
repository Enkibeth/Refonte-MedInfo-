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
import { pubmedResearchTool } from './pubmed';

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
export {
  PUBMED_MCP_URL,
  resolvePubmedMcpUrl,
  pubmedMcpServers,
  pubmedResearchTool,
  runPubmedAgent,
  type AnthropicMcpServer,
} from './pubmed';

/** Noms d'outils exposés — utilisés aussi par le client pour la bulle de statut. */
export const CHAT_TOOL_NAMES = {
  europePmc: 'europe_pmc_search',
  clinicalTrials: 'clinical_trials_search',
  verifyLinks: 'verify_source_links',
  pubmedAgent: 'pubmed_search',
} as const;

export interface BuildChatToolsOptions {
  fetchImpl?: typeof fetch;
  /**
   * Délégation orchestrateur → sous-agent (ADR-0030 suivi) : quand le modèle principal
   * du chat n'est PAS Claude, le chatbot pro reçoit l'outil `pubmed_search` dont
   * l'exécution lance un sous-agent Claude porteur du connecteur MCP PubMed.
   */
  pubmedAgent?: boolean;
}

/**
 * Outils disponibles selon le chatbot :
 *  - les 3 chatbots : recherche bibliographique + vérification des liens ;
 *  - professionnel : + essais cliniques (« essais en cours » = demande de cliniciens)
 *    et, sur option, le sous-agent PubMed délégué (voir BuildChatToolsOptions).
 */
export function buildChatTools(
  chatbot: ChatbotId,
  opts: BuildChatToolsOptions = {},
): Record<string, unknown> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const tools: Record<string, unknown> = {
    [CHAT_TOOL_NAMES.europePmc]: europePmcSearchTool(fetchImpl),
    [CHAT_TOOL_NAMES.verifyLinks]: verifySourceLinksTool(fetchImpl),
  };
  if (chatbot === 'professional') {
    tools[CHAT_TOOL_NAMES.clinicalTrials] = clinicalTrialsSearchTool(fetchImpl);
    if (opts.pubmedAgent) {
      tools[CHAT_TOOL_NAMES.pubmedAgent] = pubmedResearchTool();
    }
  }
  return tools;
}

/**
 * Section « outils de fiabilisation » concaténée au system prompt (comme le contexte
 * utilisateur) : les prompts produit de Hugo restent la source de vérité du
 * comportement, cette section explique seulement QUAND déléguer aux outils.
 */
export function buildChatToolsSection(
  chatbot: ChatbotId,
  opts: { pubmedMcp?: boolean; pubmedAgent?: boolean } = {},
): string {
  const lines = [
    `- ${CHAT_TOOL_NAMES.europePmc} : littérature biomédicale réelle (PubMed/Europe PMC : auteurs, journal, année, DOI, citations). À utiliser dès que tu cites une étude — ne cite jamais un article que tu n'as pas retrouvé par cet outil ou la recherche web.`,
  ];
  if (chatbot === 'professional') {
    lines.push(
      `- ${CHAT_TOOL_NAMES.clinicalTrials} : essais cliniques enregistrés (ClinicalTrials.gov : NCT, statut, phase). À utiliser pour toute question sur les essais en cours ou les thérapies émergentes — n'invente jamais un NCT ni un statut de recrutement.`,
    );
  }
  if (opts.pubmedMcp) {
    lines.push(
      `- outils PubMed (serveur officiel, via MCP) : recherche PubMed directe (MeSH, PMID, abstracts). À privilégier pour retrouver les références [ÉTUDE] ; croise avec ${CHAT_TOOL_NAMES.europePmc} au besoin.`,
    );
  }
  if (opts.pubmedAgent) {
    lines.push(
      `- ${CHAT_TOOL_NAMES.pubmedAgent} : délègue la recherche à un sous-agent spécialisé avec accès direct à PubMed (MeSH, PMID, abstracts) — il renvoie une synthèse de références réelles. À utiliser pour les questions exigeant des références précises ; ne cite jamais une référence qu'il n'a pas renvoyée.`,
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
