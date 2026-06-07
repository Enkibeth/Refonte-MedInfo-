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
  type UIMessageChunk,
} from 'ai';

import { getRuntimeForFeature } from '@/ai/providers/featureRuntime';

import { extractUserTexts, screenConversation } from '@/ai/orchestrator';
import { getStage2Classifier } from '@/ai/classifier/llmStage2';
import { CHAT_PERSONAS, resolveChatPersona } from '@/ai/routing/serverPersona';
import { getActivePrompt } from '@/ai/prompts/index';
import { validateOutput } from '@/ai/guardrails/outputValidator';
import { buildRefusalChunks } from '@/ai/guardrails/refusalStream';
import { logInteraction } from '@/ai/logging/logInteraction';
import { checkChatRateLimit } from '@/ai/rateLimit/chatRateLimit';
import { retrieveRagContext, buildRagSystemSection, RAG_REFUSAL_MESSAGE } from '@/rag/retrieval';
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

  let body: { messages?: unknown[]; persona?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

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

  if (rag.chunks.length === 0) {
    await logInteraction({
      persona,
      model_used: 'none',
      latency_ms: Date.now() - startMs,
      refusal_triggered: true,
      guardrail_layer: 'rag_cite_or_refuse',
      intent_category: 'general_info',
    });

    const ragRefusalStream = createUIMessageStream({
      execute: ({ writer }) => {
        const id = generateId();
        writer.write({ type: 'text-start', id } as UIMessageChunk);
        writer.write({ type: 'text-delta', id, delta: RAG_REFUSAL_MESSAGE } as UIMessageChunk);
        writer.write({ type: 'text-end', id } as UIMessageChunk);
      },
    });
    return createUIMessageStreamResponse({ stream: ragRefusalStream });
  }

  // Modèle + réglages admin (feature key "chat") : température, raisonnement,
  // verbosité et recherche internet (cf src/ai/providers/featureRuntime.ts).
  // Le web_search est OFF par défaut : la garantie « cite-or-refuse » du RAG
  // HAS/ANSM reste prioritaire tant qu'un admin ne l'active pas explicitement.
  const runtime = await getRuntimeForFeature('chat');
  const { tools: webTools, ...callOptions } = runtime.options;

  const result = streamText({
    model: runtime.model,
    system: `${prompt.template}${buildRagSystemSection(rag)}`,
    messages: modelMessages,
    tools: { ...getToolsForPersona(persona), ...(webTools ?? {}) },
    ...callOptions,
  });

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      // On bufferise la réponse complète pour pouvoir la valider AVANT de l'émettre :
      // la couche 3 doit pouvoir REMPLACER une sortie diagnostique, ce qu'un streaming
      // token-par-token rendrait impossible (le texte serait déjà parti).
      const buffered: UIMessageChunk[] = [];
      let fullText = '';
      for await (const chunk of result.toUIMessageStream()) {
        if (chunk.type === 'text-delta') fullText += chunk.delta;
        buffered.push(chunk);
      }

      const validation = validateOutput(fullText);
      const usage = await result.usage;

      if (validation.blocked) {
        // Couche 3 : sortie diagnostique détectée → réponse remplacée par le refus.
        for (const chunk of buildRefusalChunks('output_validation', generateId)) {
          writer.write(chunk);
        }
      } else {
        for (const chunk of buffered) writer.write(chunk);
      }

      await logInteraction({
        persona,
        model_used: runtime.modelId,
        tokens_in: usage?.inputTokens,
        tokens_out: usage?.outputTokens,
        latency_ms: Date.now() - startMs,
        refusal_triggered: validation.blocked,
        guardrail_layer: validation.blocked ? 'output_validation' : 'none',
        intent_category: 'general_info',
      });
    },
  });

  return createUIMessageStreamResponse({ stream });
}
