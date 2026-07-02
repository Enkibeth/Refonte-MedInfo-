/**
 * PubMed pour le chat professionnel (ADR-0030, suivi) — deux voies selon le modèle :
 *
 *  1. Modèle du chat = Claude → connecteur MCP DIRECT (`pubmedMcpServers`) : les outils
 *     PubMed hébergés par Anthropic (pubmed.mcp.claude.com, sans auth) sont montés sur
 *     l'appel principal via `providerOptions.anthropic.mcpServers` (beta mcp-client
 *     ajoutée automatiquement par @ai-sdk/anthropic).
 *  2. Modèle du chat ≠ Claude (gpt-5.2 par défaut) → DÉLÉGATION : l'orchestrateur reçoit
 *     un outil `pubmed_search` dont l'exécution lance un SOUS-AGENT Claude (feature
 *     `pubmed_agent`, configurable panel admin) qui, lui, monte le connecteur MCP et
 *     renvoie une synthèse de références réelles (PMID/DOI/URL).
 *
 * `PUBMED_MCP_URL=off` (env) désactive les deux voies sans redéploiement.
 *
 * ⚠️  CONVENTION : le modèle du sous-agent (feature key: "pubmed_agent") est configurable
 * depuis le panel admin (app/(admin)/index.tsx) ; déclaré dans src/admin/index.ts
 * AI_FEATURES, FEATURE_DEFAULTS, promptStore et la migration 0031.
 */
import { generateText, stepCountIs, tool } from 'ai';
import { z } from 'zod';

import { getRuntimeForFeature } from '@/ai/providers/featureRuntime';
import { getPromptTemplate } from '@/ai/prompts/promptStore';
import type { ChatbotId } from '@/ai/chat/chatContext';

/** URL du serveur MCP PubMed hébergé par Anthropic (Claude for Life Sciences). */
export const PUBMED_MCP_URL = 'https://pubmed.mcp.claude.com/mcp';

const AGENT_TIMEOUT_MS = 60_000;

export interface AnthropicMcpServer {
  type: 'url';
  name: string;
  url: string;
}

/** URL effective du connecteur (env > défaut) ; null si désactivé (`off`/vide). */
export function resolvePubmedMcpUrl(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const url = (env.PUBMED_MCP_URL ?? PUBMED_MCP_URL).trim();
  if (!url || url.toLowerCase() === 'off') return null;
  return url;
}

/** Voie 1 — connecteur MCP direct : provider Anthropic + chatbot professionnel seulement. */
export function pubmedMcpServers(
  provider: string,
  chatbot: ChatbotId,
  env: Record<string, string | undefined> = process.env,
): AnthropicMcpServer[] | null {
  if (provider !== 'anthropic' || chatbot !== 'professional') return null;
  const url = resolvePubmedMcpUrl(env);
  return url ? [{ type: 'url', name: 'pubmed', url }] : null;
}

/**
 * Voie 2 — exécution du sous-agent Claude : appel `generateText` avec le connecteur MCP
 * monté. La config (modèle/params) vient du panel admin (feature `pubmed_agent`) et le
 * prompt de promptStore. Lève en cas d'échec — l'outil appelant gère le repli.
 */
export async function runPubmedAgent(
  query: string,
  env: Record<string, string | undefined> = process.env,
): Promise<string> {
  const url = resolvePubmedMcpUrl(env);
  if (!url) throw new Error('Connecteur PubMed MCP désactivé');

  const [runtime, system] = await Promise.all([
    getRuntimeForFeature('pubmed_agent'),
    getPromptTemplate('pubmed_agent'),
  ]);
  // Les tools du runtime (web_search éventuel) sont ignorés : le sous-agent n'a que PubMed.
  const { tools: _unused, providerOptions, ...callOptions } = runtime.options;
  const anthropicOptions =
    (providerOptions as { anthropic?: Record<string, unknown> } | undefined)?.anthropic ?? {};

  const result = await generateText({
    model: runtime.model,
    system,
    prompt: `Question de recherche : ${query}`,
    ...callOptions,
    providerOptions: {
      ...(providerOptions ?? {}),
      anthropic: {
        ...anthropicOptions,
        mcpServers: [{ type: 'url', name: 'pubmed', url }],
      },
    },
    stopWhen: stepCountIs(6),
    abortSignal: AbortSignal.timeout(AGENT_TIMEOUT_MS),
  });
  const text = result.text.trim();
  if (!text) throw new Error('Réponse vide du sous-agent PubMed');
  return text;
}

/**
 * Outil `pubmed_search` exposé à l'orchestrateur (modèle non-Claude, chatbot pro) :
 * délégation orchestrateur → sous-agent. Ne lève jamais — repli textuel actionnable.
 */
export function pubmedResearchTool(run: (query: string) => Promise<string> = runPubmedAgent) {
  return tool({
    description:
      'Délègue une recherche bibliographique à un sous-agent spécialisé disposant d’un accès direct à PubMed (MeSH, abstracts, PMID). ' +
      'Renvoie une synthèse de références réelles : titre, auteurs, journal, année, PMID/DOI, URL PubMed, résultat principal. ' +
      "À utiliser pour toute question nécessitant des références précises de la littérature — n'invente jamais une référence que le sous-agent n'a pas renvoyée.",
    inputSchema: z.object({
      query: z
        .string()
        .min(3)
        .describe('Question de recherche complète et autonome (français ou anglais)'),
    }),
    execute: async ({ query }: { query: string }) => {
      try {
        return await run(query);
      } catch {
        return 'Sous-agent PubMed indisponible — appuie-toi sur europe_pmc_search et la recherche web, et signale toute incertitude.';
      }
    },
  });
}
