/**
 * Route API chat — POST /api/chat (Expo Router API route, web).
 *
 * Refonte 2026-06 (décision Hugo) : un chat DIRECT et fonctionnel d'abord.
 *   - 3 chatbots = 3 prompts produit complets (public.v3 / student.v3 / professional.v2),
 *     éditables depuis le panel admin (table ai_prompts, fallback PROMPT_DEFAULTS).
 *   - Le client choisit son chatbot (`body.chatbot`) ; côté serveur, seuls les comptes
 *     vérifiés étudiant/professionnel (et admins) peuvent utiliser les chats étudiant/pro.
 *   - Contexte utilisateur (prénom/âge/sexe) injecté depuis le profil.
 *   - PAS de classifieur pré-LLM, pas de validation de sortie, pas de RAG, pas de
 *     rate-limit : les couches de sécurité seront réintroduites une fois l'ébauche validée.
 *
 * Workflow agents qualité (2026-07, ADR-0030) : le modèle orchestre une boucle
 * agentique avec des outils serveur déterministes — recherche bibliographique réelle
 * (Europe PMC), essais cliniques (ClinicalTrials.gov, chatbot pro) et vérification des
 * liens sources avant rédaction (src/ai/chat/tools/). Objectif : qualité/vérifiabilité
 * des réponses — ce n'est PAS une couche de régulation.
 *
 * ⚠️  CONVENTION : le modèle utilisé (feature key: "chat") est configurable depuis le
 * panel admin (app/(admin)/index.tsx). Si tu ajoutes une étape IA ici, déclare-la dans
 * src/admin/index.ts AI_FEATURES.
 */
import { streamText, convertToModelMessages, stepCountIs } from 'ai';

import { getRuntimeForFeature } from '@/ai/providers/featureRuntime';
import { getPromptTemplate } from '@/ai/prompts/promptStore';
import { resolveChatPersona } from '@/ai/routing/serverPersona';
import { logInteraction } from '@/ai/logging/logInteraction';
import { coerceConversationId, saveAssistantMessageServer } from '@/chat/serverHistory';
import { createServerSupabaseClient } from '@/db/serverSupabase';
import {
  buildUserContextSection,
  coerceChatbot,
  coercePersonalInfo,
  type ChatbotId,
} from '@/ai/chat/chatContext';
import {
  buildChatTools,
  buildChatToolsSection,
  pubmedMcpServers,
  resolvePubmedMcpUrl,
} from '@/ai/chat/tools';
import type { Persona } from '@/ai/prompts/_schema';

/**
 * Chatbots autorisés selon la persona vérifiée du compte.
 * Essai sans inscription (2026-06) : un visiteur anonyme découvre les 3 chatbots
 * (`guestTrial`), mais il est limité à UN message utilisateur (voir POST ci-dessous).
 */
export function allowedChatbotsFor(
  persona: Persona | null,
  opts: { guestTrial?: boolean } = {},
): ChatbotId[] {
  if (opts.guestTrial || persona === 'student' || persona === 'professional') {
    return ['public', 'student', 'professional'];
  }
  return ['public'];
}

/** Nombre maximal de messages utilisateur d'une conversation anonyme (essai gratuit). */
export const GUEST_TRIAL_MAX_USER_MESSAGES = 1;

export async function POST(request: Request): Promise<Response> {
  const startMs = Date.now();

  let body: {
    messages?: unknown[];
    chatbot?: unknown;
    personalInfo?: unknown;
    conversationId?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const uiMessages = Array.isArray(body.messages) ? body.messages : [];
  const personalInfo = coercePersonalInfo(body.personalInfo);

  // Persona vérifiée côté serveur (token → profil). Le body ne donne JAMAIS de droits :
  // il exprime seulement quel chatbot l'utilisateur veut utiliser, parmi ceux autorisés.
  const resolution = await resolveChatPersona(request, body.chatbot);

  // Essai sans inscription : un appel anonyme n'a droit qu'à UN message utilisateur.
  // L'indicateur 1/1 → 0/1 vit côté client ; ce verrou serveur empêche de poursuivre
  // une conversation anonyme en rejouant la requête avec un historique plus long.
  if (!resolution.verified) {
    const userMessageCount = uiMessages.filter(
      (m) => (m as { role?: unknown }).role === 'user',
    ).length;
    if (userMessageCount > GUEST_TRIAL_MAX_USER_MESSAGES) {
      return new Response(
        JSON.stringify({
          error: 'signup_required',
          message: 'Créez un compte gratuit ou connectez-vous pour continuer la conversation.',
        }),
        { status: 401, headers: { 'content-type': 'application/json' } },
      );
    }
  }

  const requestedChatbot = coerceChatbot(body.chatbot);
  const allowed = allowedChatbotsFor(resolution.persona, { guestTrial: !resolution.verified });
  const chatbot: ChatbotId = allowed.includes(requestedChatbot) ? requestedChatbot : 'public';

  const [template, runtime] = await Promise.all([
    getPromptTemplate(chatbot),
    // Recherche web ON par défaut pour le chat : les prompts exigent des sources réelles
    // (URLs vérifiables HAS/ESC/PubMed…) — sans web search le modèle ne peut pas les fournir.
    getRuntimeForFeature('chat', { webSearch: true }),
  ]);

  const modelMessages = await convertToModelMessages(uiMessages as any);
  const { tools: webTools, ...callOptions } = runtime.options;

  // PubMed pour le chatbot pro (suivi ADR-0030), deux voies :
  //  - modèle Claude → connecteur MCP direct sur l'appel principal ;
  //  - autre modèle (gpt-5.2 par défaut) → délégation : l'orchestrateur reçoit l'outil
  //    `pubmed_search`, exécuté par un SOUS-AGENT Claude (feature `pubmed_agent`) qui
  //    monte le connecteur MCP. Requiert ANTHROPIC_API_KEY ; `PUBMED_MCP_URL=off` coupe tout.
  const mcpServers = pubmedMcpServers(runtime.provider, chatbot);
  if (mcpServers) {
    callOptions.providerOptions = {
      ...(callOptions.providerOptions ?? {}),
      anthropic: { ...(callOptions.providerOptions?.anthropic ?? {}), mcpServers },
    };
  }
  const pubmedAgent =
    !mcpServers &&
    chatbot === 'professional' &&
    runtime.provider !== 'anthropic' &&
    Boolean(process.env.ANTHROPIC_API_KEY) &&
    resolvePubmedMcpUrl() !== null;

  const system = `${template}${buildUserContextSection(personalInfo)}${buildChatToolsSection(chatbot, { pubmedMcp: mcpServers !== null, pubmedAgent })}`;

  // Workflow agents (ADR-0030) : le modèle orchestre des outils qualité serveur
  // (Europe PMC, ClinicalTrials.gov pour le pro, vérification des liens sources).
  // Gemini n'accepte pas de mélanger googleSearch et function tools : dans ce cas
  // on garde la recherche web du provider et on renonce aux outils custom.
  const qualityTools = buildChatTools(chatbot, { pubmedAgent });
  const tools =
    runtime.provider === 'google' && webTools
      ? webTools
      : { ...(webTools ?? {}), ...qualityTools };

  // Résilience hors-ligne (2026-06) : la réponse est archivée CÔTÉ SERVEUR en fin de
  // génération (et non plus par le client) — la propriété de la conversation est
  // vérifiée contre le user du token, jamais le body (src/chat/serverHistory.ts).
  const conversationId = resolution.verified && resolution.userId ? coerceConversationId(body.conversationId) : null;

  const result = streamText({
    model: runtime.model,
    system,
    messages: modelMessages,
    ...(Object.keys(tools).length > 0 ? { tools } : {}),
    // Boucle agentique : le modèle peut enchaîner recherche → vérification → rédaction.
    // Borné pour ne jamais boucler indéfiniment (chaque étape = un appel LLM).
    stopWhen: stepCountIs(8),
    ...callOptions,
    onFinish: async ({ text, steps, usage }) => {
      // En multi-étapes, `text` ne contient que la DERNIÈRE étape : on archive la
      // concaténation de toutes les étapes (= ce que le client a affiché).
      const fullText =
        Array.isArray(steps) && steps.length > 1
          ? steps.map((s) => s.text ?? '').join('')
          : text;
      if (conversationId && resolution.userId) {
        const supabase = createServerSupabaseClient();
        if (supabase) {
          await saveAssistantMessageServer(supabase, {
            conversationId,
            userId: resolution.userId,
            content: fullText,
          });
        }
      }
      await logInteraction({
        persona: chatbot,
        model_used: runtime.modelId,
        tokens_in: usage?.inputTokens,
        tokens_out: usage?.outputTokens,
        latency_ms: Date.now() - startMs,
        refusal_triggered: false,
        guardrail_layer: 'none',
        intent_category: 'general_info',
      });
    },
  });

  // Si le client se déconnecte en plein stream (page suspendue par iOS, réseau coupé),
  // la génération va quand même au bout : onFinish archive la réponse, que l'utilisateur
  // retrouvera dans son historique au retour dans l'app.
  void result.consumeStream();

  return result.toUIMessageStreamResponse();
}
