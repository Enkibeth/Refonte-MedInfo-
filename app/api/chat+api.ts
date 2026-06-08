/**
 * Route API chat — POST /api/chat (Expo Router API route, web).
 * Defense-in-depth 3 couches (01_REGULATION §4, 04_CHATBOT §4) :
 *   Couche 1 : classifieur d'intention (pré-LLM, déterministe) — appliqué à TOUS les
 *              tours utilisateur via l'orchestrateur (screenConversation), jamais au seul
 *              dernier message (durcissement audit I1).
 *   Couche 2 : contrainte prompt (system prompt public.v2).
 *   Couche 3 : validation de sortie (marqueurs diagnostiques) — la réponse complète est
 *              validée AVANT d'être transmise au client ; si bloquée, elle est REMPLACÉE
 *              par le refus canonique (durcissement audit B1).
 * Le refus (couche 1 ou couche 3) est émis dans le format de flux UI-message pour
 * s'AFFICHER réellement (durcissement audit I2).
 * Logging ai_interactions (service_role, aucune donnée santé identifiable).
 */
import {
  streamText,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
} from 'ai';

import { getRuntimeForFeature } from '@/ai/providers/featureRuntime';

import { extractUserTexts, screenConversation } from '@/ai/orchestrator';
import { getStage2Classifier } from '@/ai/classifier/llmStage2';
import { CHAT_PERSONAS, resolveChatPersona } from '@/ai/routing/serverPersona';
import { getActivePrompt } from '@/ai/prompts/index';
import { buildRefusalChunks } from '@/ai/guardrails/refusalStream';
import { gateUiMessageStream, type GateReport } from '@/ai/guardrails/streamGate';
import { logInteraction } from '@/ai/logging/logInteraction';
import { checkChatRateLimit } from '@/ai/rateLimit/chatRateLimit';
import { retrieveRagContext, buildRagSystemSection } from '@/rag/retrieval';
import {
  buildResponseDirectives,
  coerceGeneration,
  coercePersonalInfo,
  reasoningEffortFor,
  verbosityFor,
  maxTokensFor,
} from '@/ai/chat/responseDirectives';
import { proposeFollowupsTool } from '@/ai/skills/propose_followups';
import { showSourcesTool } from '@/ai/skills/show_sources';
import { refuseAndRedirectTool } from '@/ai/skills/refuse_and_redirect';
import { renderQcmTool } from '@/ai/skills/render_qcm';
import type { Persona } from '@/ai/prompts/_schema';

// ⚠️  CONVENTION : si tu ajoutes une fonctionnalité IA, enregistre-la dans
// src/admin/index.ts (AI_FEATURES) et src/ai/providers/featureModel.ts.
// Personas servables par la route chat MVP. Source unique : serverPersona.CHAT_PERSONAS
// (dérivées côté serveur depuis le profil vérifié, jamais depuis body.persona).
export const VALID_PERSONAS: Persona[] = CHAT_PERSONAS;

export function getToolsForPersona(persona: Persona) {
  // Matrice 04_CHATBOT §8 : public = 3 tools ; student ajoute render_qcm.
  const commonTools = {
    propose_followups: proposeFollowupsTool,
    show_sources: showSourcesTool,
    refuse_and_redirect: refuseAndRedirectTool,
  };

  if (persona === 'student') {
    return { ...commonTools, render_qcm: renderQcmTool };
  }

  return commonTools;
}


export async function POST(request: Request): Promise<Response> {
  const startMs = Date.now();

  let body: {
    messages?: unknown[];
    persona?: unknown;
    generation?: unknown;
    personalInfo?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  // Réglages utilisateur (curseurs réflexion/détail) + contexte perso (prénom/âge/sexe).
  // Non-autoritaires : ils n'influencent ni la persona, ni le quota, ni le safe-box ; ils
  // ne servent qu'à moduler la génération et personnaliser l'information générale (ADR-0021).
  const generation = coerceGeneration(body.generation);
  const personalInfo = coercePersonalInfo(body.personalInfo);

  // ── Persona EFFECTIVE dérivée du serveur (CC-01, INV-A) ───────────────────────
  // JAMAIS depuis body.persona : un client anonyme/public ne peut pas s'auto-élever en
  // student (chemin classifieur assoupli + outil render_qcm). La persona pilote ensuite
  // le safe-box, la matrice d'outils ET le quota.
  const personaResolution = await resolveChatPersona(request, body.persona);
  const persona = personaResolution.persona;

  if (personaResolution.attemptedElevation) {
    // Incident sécurité sans PII : le client a réclamé une persona non accordée.
    console.warn(
      `[chat] persona elevation refused: requested=${personaResolution.requested} ` +
        `granted=${persona} verified=${personaResolution.verified}`,
    );
  }

  const uiMessages = Array.isArray(body.messages) ? body.messages : [];

  // 03_SECURITY §3 / 02_ARCHITECTURE §3 [1] : rate-limit AVANT la couche 1.
  // Compteur technique uniquement (user/persona ou IP hash/persona), aucune donnée santé.
  const rateLimit = await checkChatRateLimit(request, persona);
  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({
        error: 'Rate limit exceeded',
        daily_limit: rateLimit.dailyLimit,
        remaining: rateLimit.remaining,
        reset_at: rateLimit.resetAt,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': Math.max(
            1,
            Math.ceil((new Date(rateLimit.resetAt).getTime() - Date.now()) / 1000),
          ).toString(),
        },
      },
    );
  }

  // ── Couche 1 : classifieur d'intention sur TOUTE la conversation (pré-LLM) ─────
  // Étage 1 (regex) toujours actif ; étage 2 (deuxième lecture LLM, Gemini 2.5 Flash-Lite)
  // injecté SI configuré : il relit les tours que le regex ne tranche pas pour réduire les
  // sur-refus `ambiguous` (07_CLASSIFIER §2-4) sans jamais court-circuiter le refus
  // déterministe des marqueurs explicites. Sans clé Gemini → undefined → fail-safe inchangé.
  const screen = await screenConversation(uiMessages, {
    allowFictiveEducationalCases: persona === 'student',
    llmStage2: getStage2Classifier(),
  });

  if (!screen.allowed) {
    await logInteraction({
      persona,
      model_used: 'none',
      latency_ms: Date.now() - startMs,
      refusal_triggered: true,
      guardrail_layer: 'classifier',
      intent_category: screen.category,
    });

    const refusalStream = createUIMessageStream({
      execute: ({ writer }) => {
        for (const chunk of buildRefusalChunks(screen.category, generateId)) {
          writer.write(chunk);
        }
      },
    });
    return createUIMessageStreamResponse({ stream: refusalStream });
  }

  // ── Couches 2 & 3 : LLM + validation de sortie (bufferisée avant émission) ─────
  const prompt = getActivePrompt(persona);
  const modelMessages = await convertToModelMessages(uiMessages as any);
  const lastUserText = [...extractUserTexts(uiMessages)].filter((text) => text.trim().length > 0).pop() ?? '';
  const rag = await retrieveRagContext(lastUserText);

  // Mode « web fiable d'abord » (ADR-0021) : le corpus RAG interne étant encore réduit, on
  // n'oppose PLUS un refus déterministe quand il est vide. Le LLM s'appuie alors sur une
  // recherche web restreinte aux sources officielles (cite-or-refuse conservé : on cite une
  // source fiable ou on le dit). Le contexte RAG, s'il existe, reste injecté en appui.
  const ragSection =
    rag.chunks.length > 0
      ? buildRagSystemSection(rag)
      : '\n\n# CONTEXTE RAG OFFICIEL\nAucun extrait du corpus interne ne couvre cette question : ' +
        'appuie-toi sur la recherche web restreinte aux sources officielles fiables (voir plus haut).';

  const directives = buildResponseDirectives(persona, { personalInfo, generation });

  // Modèle + réglages : la config admin (feature key "chat") est SURCHARGÉE par les curseurs
  // utilisateur (réflexion → effort de raisonnement, détail → verbosité + budget de sortie) et
  // la recherche web est forcée à ON pour ce mode (cf src/ai/providers/featureRuntime.ts).
  const runtime = await getRuntimeForFeature('chat', {
    reasoningEffort: reasoningEffortFor(generation),
    verbosity: verbosityFor(generation),
    webSearch: true,
    maxOutputTokens: maxTokensFor(generation),
  });
  const { tools: webTools, ...callOptions } = runtime.options;

  const result = streamText({
    model: runtime.model,
    system: `${prompt.template}${directives}${ragSection}`,
    messages: modelMessages,
    tools: { ...getToolsForPersona(persona), ...(webTools ?? {}) },
    ...callOptions,
  });

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      // Couche 3 STREAMING (ADR-0022) : validation incrémentale. On diffuse la réponse
      // par préfixes DÉJÀ validés ; dès qu'un marqueur diagnostique apparaît dans le
      // cumul, on remplace par le refus canonique et on coupe la suite. Décision
      // identique à la validation bufferisée (validateOutput monotone), mais progressive.
      const report: GateReport = { blocked: false, fullText: '' };
      for await (const chunk of gateUiMessageStream(result.toUIMessageStream(), generateId, report)) {
        writer.write(chunk);
      }

      const usage = await result.usage;

      await logInteraction({
        persona,
        model_used: runtime.modelId,
        tokens_in: usage?.inputTokens,
        tokens_out: usage?.outputTokens,
        latency_ms: Date.now() - startMs,
        refusal_triggered: report.blocked,
        guardrail_layer: report.blocked ? 'output_validation' : 'none',
        intent_category: 'general_info',
      });
    },
  });

  return createUIMessageStreamResponse({ stream });
}
