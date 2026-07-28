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
import {
  streamText,
  generateText,
  convertToModelMessages,
  stepCountIs,
  createUIMessageStream,
  createUIMessageStreamResponse,
} from 'ai';

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
  forceFinalAnswerStep,
  responseModeRuntime,
} from '@/ai/chat/responseMode';
import { buildOutputToolsSection, coerceChatOutputTools } from '@/ai/chat/outputTools';
import { appendAttachmentToModelMessages, coerceChatAttachment } from '@/ai/chat/attachment';
import { isConversationalTurn, latestUserText } from '@/ai/chat/turnKind';
import { splitModeEnabled, buildBriefSection } from '@/ai/chat/split';
import {
  RESEARCH_DATA_PART_ID,
  buildResearchTimeline,
  webSearchCallsOfStep,
  type ResearchEvent,
  type ResearchPhase,
} from '@/ai/chat/researchTimeline';
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

  // MODE RAPIDE (retour Hugo 2026-07) : UNE réponse directe, sur un modèle bon marché
  // (feature `chat_fast`, gpt-5-mini), SANS outil, SANS recherche web et SANS split.
  // L'ancien mode « rapide » enchaînait deux modèles et plafonnait la sortie à 1400
  // tokens (raisonnement compris) : il était le chemin le plus lent et pouvait renvoyer
  // une réponse vide. Le prompt du mode interdit explicitement de citer des sources non
  // vérifiées (buildResponseModeSection) — le modèle n'a plus rien pour les vérifier.
  const directMode = modeRuntime.directAnswer === true;

  const [template, runtime] = await Promise.all([
    getPromptTemplate(chatbot),
    // Recherche web ON par défaut pour le chat : les prompts exigent des sources réelles
    // (URLs vérifiables HAS/ESC/PubMed…) — sans web search le modèle ne peut pas les fournir.
    // En mode rapide elle est coupée (réponse de mémoire, assumée par le prompt du mode).
    getRuntimeForFeature(directMode ? 'chat_fast' : 'chat', {
      webSearch: !directMode,
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

  // ── Split orchestrateur / rédacteur (audit 2026-07, flag CHAT_ORCHESTRATOR_SPLIT) ─────
  // PHASE 1 : un modèle bon marché (feature `chat_researcher`, gpt-5-mini) PORTE la boucle
  // d'outils (recherche → lecture → vérification des liens) et rassemble un DOSSIER DE
  // PREUVES vérifié. PHASE 2 (streamText plus bas) : le modèle du chat (gpt-5.2) RÉDIGE la
  // réponse clinique À PARTIR du dossier, sans outils. But : couper le coût d'entrée (porté
  // par le modèle bon marché pendant la recherche) en gardant la rédaction patient sur le
  // modèle fiable. ACTIF par défaut (kill-switch `CHAT_ORCHESTRATOR_SPLIT=off` pour revenir
  // au mono-modèle) ; FAIL-OPEN : si la recherche échoue, dossier vide → repli mono-modèle.
  const splitActive =
    splitModeEnabled() && !conversational && !directMode && !(attachment && canAttach);

  // Résilience hors-ligne (2026-06) : la réponse est archivée CÔTÉ SERVEUR en fin de
  // génération (et non plus par le client) — la propriété de la conversation est
  // vérifiée contre le user du token, jamais le body (src/chat/serverHistory.ts).
  const conversationId = resolution.verified && resolution.userId ? coerceConversationId(body.conversationId) : null;
  // Régénération : remplacer la dernière réponse archivée au lieu d'en empiler une
  // seconde (le flag ne donne aucun droit — la propriété de la conversation est
  // toujours vérifiée contre le user du token dans saveAssistantMessageServer).
  const regenerate = body.regenerate === true;

  // ── Timeline des étapes de recherche (2026-07, « Étapes » à la Vera Health) ──────────
  // La réponse HTTP démarre TOUT DE SUITE (createUIMessageStream) et la progression réelle
  // de la boucle d'outils — y compris la phase 1 du split, jusqu'ici invisible — est
  // streamée en data parts `data-research` réconciliées (id stable). Les compteurs
  // viennent des outils eux-mêmes (hitCount Europe PMC, verdicts de liens…), jamais du
  // modèle. Tour conversationnel / mode rapide : pas de recherche, pas de timeline.
  const showTimeline = !conversational && !directMode;

  const stream = createUIMessageStream({
    onError: () => 'Une erreur est survenue pendant la génération.',
    execute: async ({ writer }) => {
      const events: ResearchEvent[] = [];
      let timelinePhase: ResearchPhase = 'analyzing';
      let timelineClosed = false;
      const writeTimeline = () => {
        if (!showTimeline || timelineClosed) return;
        try {
          writer.write({
            type: 'data-research',
            id: RESEARCH_DATA_PART_ID,
            data: buildResearchTimeline(events, timelinePhase),
          });
        } catch {
          // Flux client fermé : la génération continue (keepAlive), sans timeline.
          timelineClosed = true;
        }
      };
      const onEvent = (e: ResearchEvent) => {
        events.push(e);
        if (timelinePhase === 'analyzing') timelinePhase = 'searching';
        writeTimeline();
      };
      // Recherches web (outil exécuté par le provider) : elles ne passent pas par nos
      // hooks d'outils — comptées à la fin de chaque étape (generateText) ou au fil des
      // chunks (streamText).
      const onWebSearchCalls = (count: number) => {
        for (let i = 0; i < count; i++) events.push({ kind: 'web' });
        if (count > 0) {
          if (timelinePhase === 'analyzing') timelinePhase = 'searching';
          writeTimeline();
        }
      };

      // Le pipeline complet (phase 1 + rédaction) vit dans UNE promesse couverte par
      // keepAlive : si le client se déconnecte (page suspendue par iOS, réseau coupé),
      // la génération va au bout et onFinish archive la réponse, que l'utilisateur
      // retrouve dans son historique au retour dans l'app. `consumeStream()` seul ne
      // suffit pas en serverless : l'invocation est gelée dès que la réponse HTTP est
      // avortée — `keepAlive` la prolonge (no-op en local).
      const pipeline = (async () => {
        // Ouvre le message assistant TOUT DE SUITE (protocole UI stream : les data parts
        // doivent suivre un `start`) ; le stream de texte mergé plus bas n'en renvoie pas
        // de second (sendStart: false).
        writer.write({ type: 'start' });
        writeTimeline(); // « Analyse de la question » visible immédiatement.

        // ── Phase 1 du split (voir bloc `splitActive` ci-dessus) ────────────────────
        let briefSection = '';
        let researcherLog:
          | { modelId: string; usage: unknown; metrics: ReturnType<typeof summarizeSteps> }
          | null = null;

        if (splitActive) {
          try {
            const researcher = await getRuntimeForFeature('chat_researcher', { webSearch: true });
            const researcherPrompt = await getPromptTemplate('chat_researcher');
            const { tools: researcherWebTools, ...researcherCall } = researcher.options;
            const researcherPubmedAgent =
              chatbot === 'professional' &&
              researcher.provider !== 'anthropic' &&
              Boolean(process.env.ANTHROPIC_API_KEY) &&
              resolvePubmedMcpUrl() !== null;
            const researcherQualityTools = buildChatTools(chatbot, {
              pubmedAgent: researcherPubmedAgent,
              onEvent,
            });
            const researcherTools =
              researcher.provider === 'google' && researcherWebTools
                ? researcherWebTools
                : { ...(researcherWebTools ?? {}), ...researcherQualityTools };
            const researcherSystem = `${researcherPrompt}${buildUserContextSection(personalInfo)}${buildCountryContextSection(country)}${buildChatToolsSection(chatbot, { pubmedMcp: false, pubmedAgent: researcherPubmedAgent })}${buildPharmacologySection(chatbot)}`;
            const research = await generateText({
              model: researcher.model,
              system: researcherSystem,
              messages: modelMessages,
              ...(Object.keys(researcherTools).length > 0 ? { tools: researcherTools } : {}),
              stopWhen: stepCountIs(modeRuntime.maxSteps),
              // Garde anti-dossier-vide : coupé en plein appel d'outil par le plafond
              // d'étapes, le chercheur rendait un brief VIDE → repli mono-modèle silencieux
              // (double recherche, double coût). La dernière étape est forcée en rédaction.
              prepareStep: forceFinalAnswerStep(modeRuntime.maxSteps),
              ...researcherCall,
              onStepFinish: (step) => onWebSearchCalls(webSearchCallsOfStep(step)),
            });
            briefSection = buildBriefSection(research.text);
            researcherLog = {
              modelId: researcher.modelId,
              usage: research.usage,
              metrics: summarizeSteps(research.steps),
            };
          } catch {
            // Recherche indisponible → repli mono-modèle (le rédacteur garde ses propres outils).
            briefSection = '';
          }
        }

        // Le rédacteur travaille À PARTIR du dossier (sans outils) seulement si la recherche a
        // produit un dossier ; sinon on garde le pipeline mono-modèle (outils sur le modèle du chat).
        const writerFromBrief = briefSection !== '';

        // PubMed pour le chatbot pro (suivi ADR-0030), deux voies :
        //  - modèle Claude → connecteur MCP direct sur l'appel principal ;
        //  - autre modèle (gpt-5.2 par défaut) → délégation : l'orchestrateur reçoit l'outil
        //    `pubmed_search`, exécuté par un SOUS-AGENT Claude (feature `pubmed_agent`) qui
        //    monte le connecteur MCP. Requiert ANTHROPIC_API_KEY ; `PUBMED_MCP_URL=off` coupe tout.
        // En mode rédacteur-depuis-dossier (split), le rédacteur n'a PAS d'outils : ni MCP PubMed,
        // ni sous-agent, ni recherche web (la recherche a été faite en phase 1).
        const noWriterTools = conversational || writerFromBrief || directMode;
        const mcpServers = noWriterTools ? null : pubmedMcpServers(runtime.provider, chatbot);
        if (mcpServers) {
          callOptions.providerOptions = {
            ...(callOptions.providerOptions ?? {}),
            anthropic: { ...(callOptions.providerOptions?.anthropic ?? {}), mcpServers },
          };
        }
        const pubmedAgent =
          !mcpServers &&
          !noWriterTools &&
          chatbot === 'professional' &&
          runtime.provider !== 'anthropic' &&
          Boolean(process.env.ANTHROPIC_API_KEY) &&
          resolvePubmedMcpUrl() !== null;

        // Cœur clinique du prompt produit : TOUJOURS envoyé (rôle, sécurité, recueil, formats).
        const coreSystem = `${template}${buildUserContextSection(personalInfo)}${buildCountryContextSection(country)}`;
        const system = conversational
          ? coreSystem
          : directMode
            ? // Rapide : cœur clinique + consigne du mode (qui porte le cadrage de sécurité) +
              // outils de sortie. PAS de workflow d'outils, PAS de volet pharmacologie : celui-ci
              // impose « applique le WORKFLOW DE RECHERCHE ci-dessus » et `verify_source_links`,
              // absents ici — l'y laisser inviterait à fabriquer des sources.
              `${coreSystem}${buildResponseModeSection(responseMode)}${buildOutputToolsSection(outputTools)}`
            : writerFromBrief
            ? // Rédacteur (phase 2) : cœur clinique + pharmaco/mode/outils de sortie + le dossier de
              // preuves (à la fin, contexte frais). Pas de workflow d'outils (il ne cherche pas).
              `${coreSystem}${buildPharmacologySection(chatbot)}${buildResponseModeSection(responseMode)}${buildOutputToolsSection(outputTools)}${briefSection}`
            : `${coreSystem}${buildChatToolsSection(chatbot, { pubmedMcp: mcpServers !== null, pubmedAgent })}${buildPharmacologySection(chatbot)}${buildResponseModeSection(responseMode)}${buildOutputToolsSection(outputTools)}`;

        // Workflow agents (ADR-0030) : le modèle orchestre des outils qualité serveur
        // (Europe PMC, ClinicalTrials.gov pour le pro, vérification des liens sources).
        // Gemini n'accepte pas de mélanger googleSearch et function tools : dans ce cas
        // on garde la recherche web du provider et on renonce aux outils custom.
        // Tour conversationnel OU rédacteur-depuis-dossier → aucun outil (réponse directe).
        const qualityTools = noWriterTools ? {} : buildChatTools(chatbot, { pubmedAgent, onEvent });
        const tools = noWriterTools
          ? {}
          : runtime.provider === 'google' && webTools
            ? webTools
            : { ...(webTools ?? {}), ...qualityTools };

        // Dossier prêt : la phase 2 est une pure rédaction — l'étape passe tout de suite
        // à « Rédaction » (le premier texte peut mettre quelques secondes à arriver).
        if (writerFromBrief) {
          timelinePhase = 'writing';
          writeTimeline();
        }

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
          // Garde anti-réponse-vide (incident prod 2026-07-28) : la dernière étape autorisée
          // est FORCÉE en rédaction pure (toolChoice none) — le modèle ne peut plus dépenser
          // tout son plafond en recherches et se faire couper sans avoir écrit un mot
          // (flux 200 sans texte : « rien n'est généré » + rien d'archivé pour la reprise).
          ...(Object.keys(tools).length > 0
            ? { prepareStep: forceFinalAnswerStep(modeRuntime.maxSteps) }
            : {}),
          ...callOptions,
          // Timeline (chemin mono-modèle) : recherches web du provider au fil des chunks,
          // bascule sur « Rédaction » au premier fragment de texte.
          onChunk: ({ chunk }) => {
            const c = chunk as { type?: string; toolName?: string };
            if (c.type === 'tool-call' && (c.toolName === 'web_search' || c.toolName === 'google_search')) {
              onWebSearchCalls(1);
            } else if (c.type === 'text-delta' && timelinePhase !== 'writing') {
              timelinePhase = 'writing';
              writeTimeline();
            }
          },
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
            // Split (phase 1) : logue AUSSI l'agent chercheur, comme une interaction distincte
            // (modèle bon marché) — l'onglet Coûts attribue alors correctement les tokens à
            // CHAQUE modèle. tool_calls du chercheur = la boucle de recherche (déplacée hors du
            // modèle du chat). Aucun contenu, seulement des compteurs (03_SECURITY §6).
            if (researcherLog) {
              const u = researcherLog.usage as
                | { inputTokens?: number; outputTokens?: number; inputTokenDetails?: { cacheReadTokens?: number }; cachedInputTokens?: number }
                | undefined;
              await logInteraction({
                persona: chatbot,
                model_used: researcherLog.modelId,
                conversation_id: conversationId ?? undefined,
                tokens_in: u?.inputTokens,
                tokens_out: u?.outputTokens,
                cached_tokens_in: u?.inputTokenDetails?.cacheReadTokens ?? u?.cachedInputTokens,
                steps: researcherLog.metrics?.steps,
                tool_calls: researcherLog.metrics?.toolCalls,
                refusal_triggered: false,
                guardrail_layer: 'none',
                intent_category: 'general_info',
              });
            }
          },
        });

        writer.merge(result.toUIMessageStream({ sendStart: false }));
        await result.consumeStream();
      })();

      keepAlive(pipeline);
      await pipeline;
    },
  });

  return createUIMessageStreamResponse({ stream });
}
