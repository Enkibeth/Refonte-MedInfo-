/**
 * Route API chat — POST /api/chat (Expo Router API route, web).
 *
 * ── Retour à la base (2026-08, décision Hugo : « on a trop complexifié le chatbot ») ──
 * UN prompt par catégorie, UN appel LLM, la réponse. Rien entre les deux.
 *
 *   requête ──▶ prompt du chatbot (public / student / professional)
 *                + contexte utilisateur + pays + pharmaco + mode + outils de sortie
 *           ──▶ UN streamText (gpt-5.6-luna, recherche web du provider activée)
 *           ──▶ la réponse, avec ses SOURCES, APPROFONDISSEMENTS, QUESTIONS_PATIENT…
 *
 * Ce qui a été RETIRÉ (ADR-0037), et pourquoi : chaque élément ajoutait des appels LLM
 * en série, et la latence était linéaire dans leur nombre (~15-18 s par étape mesurées en
 * prod) — split orchestrateur/rédacteur, boucle agentique multi-étapes, outils serveur
 * Europe PMC / ClinicalTrials.gov / plan_research / verify_source_links, sous-agent PubMed,
 * timeline « Étapes ». La qualité des sources repose désormais sur la recherche web du
 * provider (un seul aller-retour) et sur les exigences des prompts produit eux-mêmes.
 *
 * Ce qui RESTE : autorisation persona serveur, essai invité, pièce jointe, archivage
 * serveur (résilience hors-ligne) et instrumentation des coûts.
 *
 * ⚠️  CONVENTION : le modèle utilisé (feature key: "chat") est configurable depuis le
 * panel admin (app/(admin)/index.tsx). Si tu ajoutes une étape IA ici, déclare-la dans
 * src/admin/index.ts AI_FEATURES.
 */
import { streamText, convertToModelMessages } from 'ai';

import { getRuntimeForFeature } from '@/ai/providers/featureRuntime';
import { getPromptTemplate } from '@/ai/prompts/promptStore';
import { resolveChatPersona } from '@/ai/routing/serverPersona';
import { logInteraction } from '@/ai/logging/logInteraction';
import { summarizeSteps } from '@/ai/logging/stepMetrics';
import { coerceConversationId, saveAssistantMessageServer } from '@/chat/serverHistory';
import { createServerSupabaseClient } from '@/db/serverSupabase';
import { keepAlive } from '@/server/keepAlive';
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
  shouldDisableWebSearch,
} from '@/ai/chat/responseMode';
import { buildOutputToolsSection, coerceChatOutputTools } from '@/ai/chat/outputTools';
import { appendAttachmentToModelMessages, coerceChatAttachment } from '@/ai/chat/attachment';
import { isConversationalTurn, latestUserText } from '@/ai/chat/turnKind';
import { isAdminUserId } from '@/admin/index';
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

  // Réglages utilisateur par requête : « profondeur » de réponse et outils de sortie
  // optionnels (diagramme, points clés, tableau comparatif). Purs, bornés, sans droit.
  const responseMode = coerceResponseMode(body.responseMode);
  const outputTools = coerceChatOutputTools(body.tools);
  const modeRuntime = responseModeRuntime(responseMode, chatbot);

  // Un tour PUREMENT conversationnel (« bonjour », « merci ») n'a besoin ni de recherche
  // web, ni des sections optionnelles : réponse directe, instantanée. Détecteur
  // CONSERVATEUR (turnKind.ts) — au moindre signal de substance, tour substantiel. On ne
  // touche JAMAIS au cœur clinique du prompt, toujours envoyé : pas de routage des blocs
  // cliniques, pas de classifieur pré-LLM (ADR-0024). Une pièce jointe = tour substantiel.
  const attachment = coerceChatAttachment(body.attachment);
  // Pièce jointe : réservée aux comptes vérifiés étudiant/pro (+ admin). Le body ne donne
  // AUCUN droit : la garde est dérivée de la persona serveur. Le document est transmis au
  // modèle multimodal puis OUBLIÉ (jamais stocké).
  const canAttach =
    resolution.verified &&
    (resolution.persona === 'student' ||
      resolution.persona === 'professional' ||
      (!!resolution.userId && isAdminUserId(resolution.userId)));
  const hasAttachment = Boolean(attachment && canAttach);
  const conversational = !hasAttachment && isConversationalTurn(latestUserText(uiMessages));

  // Recherche web du provider : c'est la SEULE source externe du chat depuis le retour à
  // la base. Elle s'exécute DANS l'appel (aucune étape LLM supplémentaire).
  //
  // On ne la surcharge que pour la COUPER (tour conversationnel, mode Rapide) — jamais pour
  // l'activer, sous peine de rendre inopérant le toggle « Recherche internet » du panel
  // admin. Règle portée par un module pur testé (`shouldDisableWebSearch`).
  const noSearch = shouldDisableWebSearch(modeRuntime, { conversational });

  const [template, runtime] = await Promise.all([
    getPromptTemplate(chatbot),
    getRuntimeForFeature('chat', {
      ...(noSearch ? { webSearch: false } : {}),
      reasoningEffort: modeRuntime.reasoningEffort,
      ...(modeRuntime.capReasoningEffort ? { capReasoningEffort: modeRuntime.capReasoningEffort } : {}),
      verbosity: modeRuntime.verbosity,
      ...(modeRuntime.maxOutputTokens != null ? { maxOutputTokens: modeRuntime.maxOutputTokens } : {}),
    }),
  ]);

  const modelMessages = await convertToModelMessages(uiMessages as any);
  if (attachment && canAttach) {
    appendAttachmentToModelMessages(modelMessages as any, attachment);
  }

  // Cœur clinique du prompt produit : TOUJOURS envoyé (rôle, sécurité, recueil, formats).
  const coreSystem = `${template}${buildUserContextSection(personalInfo)}${buildCountryContextSection(country)}`;
  const system = conversational
    ? coreSystem
    : `${coreSystem}${buildPharmacologySection(chatbot)}${buildResponseModeSection(responseMode)}${buildOutputToolsSection(outputTools)}`;

  // Résilience hors-ligne (2026-06) : la réponse est archivée CÔTÉ SERVEUR en fin de
  // génération (et non par le client) — la propriété de la conversation est vérifiée
  // contre le user du token, jamais le body (src/chat/serverHistory.ts).
  const conversationId =
    resolution.verified && resolution.userId ? coerceConversationId(body.conversationId) : null;
  // Régénération : remplacer la dernière réponse archivée au lieu d'en empiler une seconde
  // (le flag ne donne aucun droit — la propriété est vérifiée dans saveAssistantMessageServer).
  const regenerate = body.regenerate === true;

  const { tools, ...callOptions } = runtime.options;

  const result = streamText({
    model: runtime.model,
    system,
    messages: modelMessages,
    // Seul outil : la recherche web du provider, exécutée par le provider À L'INTÉRIEUR de
    // l'appel. Pas de `stopWhen` : il n'y a plus de boucle agentique à borner.
    ...(tools && Object.keys(tools).length > 0 ? { tools } : {}),
    ...callOptions,
    onFinish: async ({ text, usage, steps }) => {
      // Sans `stopWhen`, l'appel tient en une étape et `text` est la réponse entière. Garde
      // défensive : si le SDK venait à en produire plusieurs, `text` ne contiendrait que la
      // DERNIÈRE — on archiverait une réponse tronquée, invisible jusqu'à ce qu'un
      // utilisateur rouvre sa conversation. Concaténer coûte trois lignes.
      const fullText =
        Array.isArray(steps) && steps.length > 1 ? steps.map((s) => s.text ?? '').join('') : text;
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
      // Instrumentation des coûts : compteurs de tokens + décompte d'appels par NOM
      // d'outil (jamais les arguments). `tool_calls` alimente la facturation des
      // recherches web dans l'onglet Coûts (src/admin/cost.ts). Migration 0034.
      const metrics = summarizeSteps(steps);
      await logInteraction({
        persona: chatbot,
        model_used: runtime.modelId,
        // Coût par conversation (2026-07) : rattache les tokens à la conversation.
        conversation_id: conversationId ?? undefined,
        tokens_in: usage?.inputTokens,
        tokens_out: usage?.outputTokens,
        // `inputTokens` INCLUT les tokens lus depuis le cache du provider (facturés ~10 %) :
        // on loggue la part cachée pour ne pas la tarifer au plein prix (cost.ts).
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

  // Page suspendue pendant le streaming (iOS coupe le flux en quittant Safari) : la
  // génération va au bout côté serveur et `onFinish` archive la réponse, que l'utilisateur
  // retrouve dans son historique au retour. `consumeStream()` seul ne suffit pas en
  // serverless (l'invocation est gelée dès la réponse HTTP avortée) — `keepAlive` la
  // prolonge via le contexte de requête Vercel (no-op en local).
  keepAlive(result.consumeStream());

  return result.toUIMessageStreamResponse();
}
