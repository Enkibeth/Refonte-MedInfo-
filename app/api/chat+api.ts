/**
 * Route API chat — POST /api/chat (Expo Router API route, web).
 *
 * Refonte 2026-06 (décision Hugo) : un chat DIRECT et fonctionnel d'abord.
 *   - 3 chatbots = 3 prompts produit complets (public.v3 / student.v4 / professional.v2),
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
import { summarizeSteps } from '@/ai/logging/stepMetrics';
import { coerceConversationId, saveAssistantMessageServer } from '@/chat/serverHistory';
import { createServerSupabaseClient } from '@/db/serverSupabase';
import {
  buildUserContextSection,
  coerceChatbot,
  coercePersonalInfo,
  type ChatbotId,
} from '@/ai/chat/chatContext';
import { buildCountryContextSection, coerceCountry } from '@/ai/chat/country';
import { buildPharmacologySection } from '@/ai/chat/pharmacology';
import {
  buildResponseModeSection,
  coerceResponseMode,
  responseModeRuntime,
} from '@/ai/chat/responseMode';
import { buildOutputToolsSection, coerceChatOutputTools } from '@/ai/chat/outputTools';
import { appendAttachmentToModelMessages, coerceChatAttachment } from '@/ai/chat/attachment';
import { isConversationalTurn, latestUserText } from '@/ai/chat/turnKind';
import { isAdminUserId } from '@/admin/index';
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
    country?: unknown;
    attachment?: unknown;
    conversationId?: unknown;
    regenerate?: unknown;
    responseMode?: unknown;
    tools?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const uiMessages = Array.isArray(body.messages) ? body.messages : [];
  const personalInfo = coercePersonalInfo(body.personalInfo);
  const country = coerceCountry(body.country);

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

  // Réglages utilisateur par requête (2026-07) : « profondeur » de réponse et outils de
  // sortie optionnels (diagramme, points clés, tableau comparatif). Purs, bornés, sans droit.
  const responseMode = coerceResponseMode(body.responseMode);
  const outputTools = coerceChatOutputTools(body.tools);
  // Le mode définit effort/verbosité/budget de sortie + le plafond d'étapes de la boucle
  // agentique. Il REMPLACE l'ancien plafond `minimal` du chat public (mode standard public
  // = même comportement qu'avant ; mode approfondi public = jusqu'à `medium`, jamais `high`).
  const modeRuntime = responseModeRuntime(responseMode, chatbot);

  const [template, runtime] = await Promise.all([
    getPromptTemplate(chatbot),
    // Recherche web ON par défaut pour le chat : les prompts exigent des sources réelles
    // (URLs vérifiables HAS/ESC/PubMed…) — sans web search le modèle ne peut pas les fournir.
    getRuntimeForFeature('chat', {
      webSearch: true,
      reasoningEffort: modeRuntime.reasoningEffort,
      ...(modeRuntime.capReasoningEffort ? { capReasoningEffort: modeRuntime.capReasoningEffort } : {}),
      verbosity: modeRuntime.verbosity,
      ...(modeRuntime.maxOutputTokens != null ? { maxOutputTokens: modeRuntime.maxOutputTokens } : {}),
    }),
  ]);

  const modelMessages = await convertToModelMessages(uiMessages as any);

  // Pièce jointe (document) : réservée aux comptes vérifiés étudiant/pro (+ admin).
  // Le body ne donne AUCUN droit : la garde est dérivée de la persona serveur. Le
  // document est transmis au modèle multimodal puis OUBLIÉ (jamais stocké).
  const attachment = coerceChatAttachment(body.attachment);
  const canAttach =
    resolution.verified &&
    (resolution.persona === 'student' ||
      resolution.persona === 'professional' ||
      (!!resolution.userId && isAdminUserId(resolution.userId)));
  if (attachment && canAttach) {
    appendAttachmentToModelMessages(modelMessages as any, attachment);
  }

  const { tools: webTools, ...callOptions } = runtime.options;

  // Assemblage conditionnel du prompt (audit latence 2026-07, item I) : un tour PUREMENT
  // conversationnel (« bonjour », « merci », « ok ») n'a besoin ni du workflow outils, ni de
  // la section pharmaco, ni d'une recherche web — on les charge À LA DEMANDE. Détecteur
  // CONSERVATEUR (turnKind.ts) : au moindre signal de substance → tour substantiel = prompt
  // complet + outils. On ne touche JAMAIS au cœur clinique du prompt produit (toujours
  // envoyé) ; pas de routage des blocs cliniques (pas de classifieur pré-LLM, cf. ADR-0024).
  // Une pièce jointe rend toujours le tour substantiel (document à analyser).
  const conversational =
    !(attachment && canAttach) && isConversationalTurn(latestUserText(uiMessages));

  // PubMed pour le chatbot pro (suivi ADR-0030), deux voies :
  //  - modèle Claude → connecteur MCP direct sur l'appel principal ;
  //  - autre modèle (gpt-5.2 par défaut) → délégation : l'orchestrateur reçoit l'outil
  //    `pubmed_search`, exécuté par un SOUS-AGENT Claude (feature `pubmed_agent`) qui
  //    monte le connecteur MCP. Requiert ANTHROPIC_API_KEY ; `PUBMED_MCP_URL=off` coupe tout.
  const mcpServers = conversational ? null : pubmedMcpServers(runtime.provider, chatbot);
  if (mcpServers) {
    callOptions.providerOptions = {
      ...(callOptions.providerOptions ?? {}),
      anthropic: { ...(callOptions.providerOptions?.anthropic ?? {}), mcpServers },
    };
  }
  const pubmedAgent =
    !mcpServers &&
    !conversational &&
    chatbot === 'professional' &&
    runtime.provider !== 'anthropic' &&
    Boolean(process.env.ANTHROPIC_API_KEY) &&
    resolvePubmedMcpUrl() !== null;

  // Cœur clinique du prompt produit : TOUJOURS envoyé (rôle, sécurité, recueil, formats).
  const coreSystem = `${template}${buildUserContextSection(personalInfo)}${buildCountryContextSection(country)}`;
  const system = conversational
    ? coreSystem
    : `${coreSystem}${buildChatToolsSection(chatbot, { pubmedMcp: mcpServers !== null, pubmedAgent })}${buildPharmacologySection(chatbot)}${buildResponseModeSection(responseMode)}${buildOutputToolsSection(outputTools)}`;

  // Workflow agents (ADR-0030) : le modèle orchestre des outils qualité serveur
  // (Europe PMC, ClinicalTrials.gov pour le pro, vérification des liens sources).
  // Gemini n'accepte pas de mélanger googleSearch et function tools : dans ce cas
  // on garde la recherche web du provider et on renonce aux outils custom.
  // Tour conversationnel → aucun outil (réponse directe, instantanée, sans recherche web).
  const qualityTools = conversational ? {} : buildChatTools(chatbot, { pubmedAgent });
  const tools = conversational
    ? {}
    : runtime.provider === 'google' && webTools
      ? webTools
      : { ...(webTools ?? {}), ...qualityTools };

  // Résilience hors-ligne (2026-06) : la réponse est archivée CÔTÉ SERVEUR en fin de
  // génération (et non plus par le client) — la propriété de la conversation est
  // vérifiée contre le user du token, jamais le body (src/chat/serverHistory.ts).
  const conversationId = resolution.verified && resolution.userId ? coerceConversationId(body.conversationId) : null;
  // Régénération : remplacer la dernière réponse archivée au lieu d'en empiler une
  // seconde (le flag ne donne aucun droit — la propriété de la conversation est
  // toujours vérifiée contre le user du token dans saveAssistantMessageServer).
  const regenerate = body.regenerate === true;

  const result = streamText({
    model: runtime.model,
    system,
    messages: modelMessages,
    ...(Object.keys(tools).length > 0 ? { tools } : {}),
    // Boucle agentique evidence-first : le modèle enchaîne recherche → lecture des
    // résumés des articles retenus → vérification des liens → rédaction. Borné pour ne
    // jamais boucler indéfiniment (chaque étape = un appel LLM). Le plafond dépend du mode
    // de réponse choisi (rapide = boucle courte ; approfondi = plus d'étapes).
    stopWhen: stepCountIs(modeRuntime.maxSteps),
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
            replaceLast: regenerate,
          });
        }
      }
      // Instrumentation latence (2026-07) : nombre d'étapes LLM + décompte d'appels par
      // outil (noms seulement, jamais les arguments) — pour savoir OÙ part le temps
      // (sous-agent PubMed ? lectures séquentielles ? rédaction ?). Migration 0034.
      const metrics = summarizeSteps(steps);
      await logInteraction({
        persona: chatbot,
        model_used: runtime.modelId,
        // Coût par conversation (2026-07) : rattache les tokens à la conversation.
        conversation_id: conversationId ?? undefined,
        tokens_in: usage?.inputTokens,
        tokens_out: usage?.outputTokens,
        // Justesse des coûts (audit 2026-07, item K) : `inputTokens` INCLUT les tokens lus
        // depuis le cache du provider (préfixe système caché d'un appel à l'autre), facturés
        // ~10 %. On loggue la part cachée pour ne pas la tarifer au plein prix (cost.ts).
        cached_tokens_in: usage?.inputTokenDetails?.cacheReadTokens ?? usage?.cachedInputTokens,
        latency_ms: Date.now() - startMs,
        steps: metrics?.steps,
        tool_calls: metrics?.toolCalls,
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
