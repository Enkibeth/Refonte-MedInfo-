import { boundRequestBody } from '@/server/requestBody';
/**
 * Route API chat — POST /api/chat (Expo Router API route, web).
 *
 * ── Retour à la base (2026-08, décision Hugo : « on a trop complexifié le chatbot ») ──
 * UN prompt par catégorie, UN appel LLM, la réponse. Rien entre les deux.
 *
 *   requête ──▶ prompt du chatbot (public / student / professional)
 *                + contexte utilisateur + pays + pharmaco + mode + outils de sortie
 *           ──▶ UN streamText (gpt-6-luna depuis 0046, recherche web du provider activée)
 *           ──▶ la réponse, avec ses SOURCES, APPROFONDISSEMENTS, QUESTIONS_PATIENT…
 *
 * Ce qui a été RETIRÉ (ADR-0037), et pourquoi : chaque élément ajoutait des appels LLM
 * en série, et la latence était linéaire dans leur nombre (~15-18 s par étape mesurées en
 * prod) — split orchestrateur/rédacteur, boucle agentique multi-étapes, outils serveur
 * Europe PMC / ClinicalTrials.gov / plan_research / verify_source_links, sous-agent PubMed.
 * La timeline « Étapes » est revenue en 2026-10, dérivée du flux de CET appel (réflexion,
 * recherches web du provider, sources citées — src/ai/chat/researchTimeline.ts) : zéro
 * appel supplémentaire. La qualité des sources repose désormais sur la recherche web du
 * provider (un seul aller-retour) et sur les exigences des prompts produit eux-mêmes.
 *
 * Ce qui RESTE : autorisation persona serveur, essai invité, pièce jointe, archivage
 * serveur (résilience hors-ligne) et instrumentation des coûts.
 *
 * Cartes d'action (2026-10, ADR-0044) : la consigne liste les outils de l'app que CET
 * utilisateur peut ouvrir ; le modèle peut en proposer un par une ligne-marqueur que
 * l'interface rend en carte. Aucun outil n'est exécuté ici : toujours un seul appel.
 *
 * ⚠️  CONVENTION : le modèle utilisé (feature key: "chat") est configurable depuis le
 * panel admin (app/admin/index.tsx). Si tu ajoutes une étape IA ici, déclare-la dans
 * src/admin/index.ts AI_FEATURES.
 */
import { streamText, convertToModelMessages } from 'ai';

import { getRuntimeForFeature } from '@/ai/providers/featureRuntime';
import { getPromptTemplate } from '@/ai/prompts/promptStore';
import { resolveChatPersona } from '@/ai/routing/serverPersona';
import { checkChatRateLimit, checkGuestChatQuota } from '@/ai/rateLimit/chatRateLimit';
import { logInteraction } from '@/ai/logging/logInteraction';
import { summarizeSteps } from '@/ai/logging/stepMetrics';
import { coerceConversationId, saveAssistantMessageServer } from '@/chat/serverHistory';
import { createServerSupabaseClient } from '@/db/serverSupabase';
import { keepAlive } from '@/server/keepAlive';
import { withSseHeartbeat } from '@/server/sseHeartbeat';
import { STREAMING_RESPONSE_HEADERS } from '@/server/streamingHeaders';
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
import { buildModuleActionsSection, moduleActionCounts, moduleToolsForRequest } from '@/ai/chat/moduleActions';
import { appendAttachmentToModelMessages, coerceChatAttachment } from '@/ai/chat/attachment';
import { buildPriorAttachmentSection, sanitizeChatHistory } from '@/ai/chat/modelHistory';
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
  const boundedBody = await boundRequestBody(request, 10 * 1024 * 1024);
  if (boundedBody instanceof Response) return boundedBody;
  request = boundedBody;
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
    capabilities?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const uiMessages = Array.isArray(body.messages) ? body.messages : [];
  // Ce que le modèle reçoit de la conversation : le TEXTE des messages, rien d'autre — ni
  // réflexion ni recherches web des tours précédents, rejouées sinon par OpenAI à chaque
  // tour (46k → 228k tokens d'entrée mesurés), ni rôle `system` ou part `file` fournis par
  // le client (src/ai/chat/modelHistory.ts).
  const history = sanitizeChatHistory(uiMessages);
  if (history.length > 100 || history.reduce((sum, m) => sum + m.parts[0].text.length, 0) > 120_000) {
    return Response.json({ error: 'Conversation trop volumineuse. Ouvrez une nouvelle conversation.' }, { status: 413 });
  }
  if (!history.some((m) => m.role === 'user')) {
    return Response.json({ error: 'Message utilisateur requis.' }, { status: 400 });
  }
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
      (m) => m !== null && typeof m === 'object' && (m as { role?: unknown }).role === 'user',
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
    // Sans ce plafond, ouvrir une nouvelle conversation à chaque requête contournait le
    // verrou ci-dessus : appels LLM illimités sans compte. Compté seulement ici, après le
    // refus 401 (qui ne coûte rien), pour ne jamais décompter une requête refusée.
    const quota = await checkGuestChatQuota(request);
    if (!quota.allowed) {
      return new Response(
        JSON.stringify({
          error: 'signup_required',
          message:
            "Limite de l'essai sans inscription atteinte pour aujourd'hui. Créez un compte gratuit ou connectez-vous pour continuer.",
        }),
        { status: 401, headers: { 'content-type': 'application/json' } },
      );
    }
  } else {
    const quota = await checkChatRateLimit(request, resolution.persona, { scope: 'chat' });
    if (!quota.allowed) {
      return Response.json({ error: 'Limite de messages atteinte pour aujourd’hui.' }, { status: 429 });
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
  const isAdmin = resolution.verified && !!resolution.userId && isAdminUserId(resolution.userId);
  const canAttach =
    resolution.verified &&
    (resolution.persona === 'student' || resolution.persona === 'professional' || isAdmin);
  const hasAttachment = Boolean(attachment && canAttach);
  const conversational = !hasAttachment && isConversationalTurn(latestUserText(history));

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
      // Résumés de réflexion → étape « Réflexion » du déroulé affiché pendant l'attente.
      reasoningSummary: true,
    }),
  ]);

  const modelMessages = await convertToModelMessages(history);
  if (attachment && canAttach) {
    appendAttachmentToModelMessages(modelMessages as any, attachment);
  }

  // Cœur clinique du prompt produit : TOUJOURS envoyé (rôle, sécurité, recueil, formats).
  // Une pièce jointe n'est transmise qu'avec son message : si l'historique en cite une que
  // le modèle ne reçoit pas, il doit le savoir plutôt que de commenter un nom de fichier.
  const coreSystem =
    `${template}${buildUserContextSection(personalInfo)}${buildCountryContextSection(country)}` +
    buildPriorAttachmentSection(history, { attachedName: hasAttachment && attachment ? attachment.name : null });
  // Cartes d'action (ADR-0044) : le modèle peut PROPOSER d'ouvrir un outil de l'app, dans
  // cette même réponse (aucun appel ni aucune étape en plus). La liste vient de la persona
  // VÉRIFIÉE, jamais du body ; un visiteur n'en reçoit aucune. Seul un client qui DÉCLARE
  // savoir les afficher reçoit la consigne : un onglet resté sur l'ancien code (chargé avant
  // un déploiement) montrerait sinon les marqueurs en clair.
  const moduleTools = moduleToolsForRequest({
    capabilities: body.capabilities,
    persona: resolution.persona,
    isAdmin,
    verified: resolution.verified,
  });
  const system = conversational
    ? coreSystem
    : `${coreSystem}${buildPharmacologySection(chatbot)}${buildResponseModeSection(responseMode)}${buildOutputToolsSection(outputTools)}${buildModuleActionsSection(moduleTools)}`;

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
      // Cartes d'outil proposées dans la réponse (ADR-0044) : `carte:<outil>`, noms seuls.
      // Seule la recherche web est facturée dans l'onglet Coûts : ces clés n'y comptent pas.
      const toolCalls = { ...(metrics?.toolCalls ?? {}), ...moduleActionCounts(fullText) };
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
        tool_calls: Object.keys(toolCalls).length > 0 ? toolCalls : metrics?.toolCalls,
        refusal_triggered: false,
        guardrail_layer: 'none',
        intent_category: 'general_info',
      });
    },
  });

  // Page suspendue pendant le streaming (iOS coupe le flux en quittant Safari) : la
  // génération va au bout côté serveur et `onFinish` archive la réponse, que l'utilisateur
  // retrouve dans son historique au retour. Le serveur Node reste vivant après la
  // déconnexion du client : `consumeStream()` suffit, `keepAlive` neutralise seulement un
  // éventuel rejet de cette promesse détachée (src/server/keepAlive.ts).
  keepAlive(result.consumeStream());

  // En-têtes anti-tampon : le flux traverse le proxy (et le CDN) de l'hébergeur. Battement
  // de cœur : une réflexion longue (mode Approfondi) n'émet rien pendant plus d'une minute,
  // et aucun intermédiaire ne doit prendre ce silence pour une connexion morte.
  //
  // `sendSources` : les sources CITÉES par le modèle (annotations url_citation) rejoignent le
  // flux — le déroulé des étapes en affiche le nombre. Le texte de la réponse reste la seule
  // chose archivée et renvoyée au modèle (modelHistory.ts) : ni ces parts ni la réflexion.
  return withSseHeartbeat(
    result.toUIMessageStreamResponse({ headers: STREAMING_RESPONSE_HEADERS, sendSources: true }),
  );
}
