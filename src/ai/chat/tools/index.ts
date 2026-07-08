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
import { europePmcSearchTool, europePmcArticleTool } from './europePmc';
import { clinicalTrialsSearchTool } from './clinicalTrials';
import { verifySourceLinksTool } from './verifyLinks';
import { pubmedResearchTool } from './pubmed';

export {
  buildEuropePmcSearchUrl,
  formatEuropePmcResults,
  buildEuropePmcArticleUrl,
  formatEuropePmcArticle,
  type EuropePmcSort,
} from './europePmc';
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
  europePmcArticle: 'europe_pmc_article',
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
    [CHAT_TOOL_NAMES.europePmcArticle]: europePmcArticleTool(fetchImpl),
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
 * Section « workflow de recherche » concaténée au system prompt (comme le contexte
 * utilisateur) : les prompts produit de Hugo restent la source de vérité du FORMAT ;
 * cette section impose le WORKFLOW evidence-first (à la OpenEvidence) — chercher la
 * littérature et les recommandations AVANT de rédiger, lire les résumés des articles
 * retenus, vérifier les liens, puis rédiger une réponse ancrée sur ce qui a été retrouvé.
 */
export function buildChatToolsSection(
  chatbot: ChatbotId,
  opts: { pubmedMcp?: boolean; pubmedAgent?: boolean } = {},
): string {
  const searchTools: string[] = [`${CHAT_TOOL_NAMES.europePmc} (études)`];
  if (chatbot === 'professional') {
    searchTools.push(`${CHAT_TOOL_NAMES.clinicalTrials} (essais en cours)`);
  }
  if (opts.pubmedMcp) searchTools.push('les outils PubMed MCP');
  // NB : pubmed_search (sous-agent délégué) n'est volontairement PAS dans la liste des
  // recherches de première intention — c'est un appel LLM imbriqué coûteux en latence,
  // réservé en seconde intention (voir sa ligne « Outils disponibles » ci-dessous).

  const steps = [
    `1. DÉCOMPOSE la question en 1 à 3 requêtes de recherche ciblées (anglais pour la littérature, syntaxe PubMed acceptée).`,
    `2. RECHERCHE AVANT DE RÉDIGER : lance en parallèle la recherche web (recommandations en vigueur : HAS, ESC, sociétés savantes…) et ${searchTools.join(' + ')}. Aucune affirmation actionnable ne doit précéder cette étape. Privilégie le récent et le fortement cité (paramètre sort : recent / cited).`,
    `3. LIS LES RÉSUMÉS : pour les 2-3 articles qui fonderont ta réponse, appelle ${CHAT_TOOL_NAMES.europePmcArticle} (PMID ou DOI, + le paramètre title repris du résultat de recherche) pour CHAQUE article EN PARALLÈLE — tous les appels dans le MÊME tour, jamais un article par tour — et appuie chaque affirmation sur le contenu réel du résumé, jamais sur le seul titre d'un résultat de recherche.`,
    `4. VÉRIFIE LES LIENS : appelle ${CHAT_TOOL_NAMES.verifyLinks} UNE SEULE fois, juste avant de rédiger la section SOURCES, avec toutes les URLs que tu prévois de citer ; remplace toute URL cassée (DOI, page officielle de niveau supérieur) ou retire la source.`,
    `5. RÉDIGE selon le format exigé par tes consignes : chaque affirmation actionnable est ancrée à une source réellement retrouvée aux étapes 2-3. Si la recherche ne retrouve rien de probant, dis-le — ne comble jamais avec une référence non retrouvée.`,
  ];

  const lines = [
    `- ${CHAT_TOOL_NAMES.europePmc} : littérature biomédicale réelle (PubMed/Europe PMC : auteurs, journal, année, DOI, citations). Ne cite jamais un article que tu n'as pas retrouvé par cet outil ou la recherche web.`,
    `- ${CHAT_TOOL_NAMES.europePmcArticle} : résumé complet d'un article (PMID/DOI) retrouvé par la recherche — la lecture qui fonde la synthèse.`,
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
      `- ${CHAT_TOOL_NAMES.pubmedAgent} : délègue la recherche à un sous-agent spécialisé avec accès direct à PubMed (MeSH, PMID, abstracts) — il renvoie une synthèse de références réelles. EN SECONDE INTENTION SEULEMENT (appel lent) : réserve-le aux questions exigeant des références précises que ${CHAT_TOOL_NAMES.europePmc} et la recherche web n'ont PAS déjà retrouvées, 1 appel maximum par réponse, jamais en première intention ; ne cite jamais une référence qu'il n'a pas renvoyée.`,
    );
  }
  lines.push(
    `- ${CHAT_TOOL_NAMES.verifyLinks} : vérifie que des URLs répondent réellement (HEAD/GET). Zéro lien mort dans SOURCES.`,
  );

  return (
    `\n\nWORKFLOW DE RECHERCHE DOCUMENTAIRE (serveur MedInfo)\n` +
    `Pour toute question médicale appelant des faits (recommandation, seuil, posologie, traitement, pronostic, étude), suis ce protocole AVANT de rédiger — comme un clinicien qui consulte la littérature avant de répondre :\n` +
    `${steps.join('\n')}\n` +
    `Exceptions : salutation, relance purement conversationnelle ou reformulation sans nouveau fait médical → réponds directement, sans recherche. Un suivi qui introduit un nouveau fait (autre molécule, autre population, autre seuil) relance le protocole.\n` +
    `Outils disponibles :\n` +
    `${lines.join('\n')}\n` +
    `Ces outils ne changent RIEN au format de réponse exigé par tes consignes ; n'affiche jamais leurs sorties brutes et ne mentionne pas leur existence à l'utilisateur.`
  );
}
