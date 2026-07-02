/**
 * Pipeline du chat (orchestrateur, ADR-0029) — séquence pour chaque message :
 *
 *   garde d'entrée (couche 1) → rate-limit → LLM principal streamé → archivage + log
 *
 * Ordre voulu : la garde passe AVANT le rate-limit pour qu'un refus ne consomme
 * jamais le quota de l'utilisateur (un refus n'est pas une réponse). Modes de
 * garde : enforce / log (observation) / off — src/ai/chat/guard/config.ts.
 *
 * Module à dépendances injectées : testé sans réseau ni LLM dans
 * tests/unit/chat-pipeline.test.ts. La route app/api/chat+api.ts reste mince
 * (parse body, persona serveur, verrou invité) et délègue ici.
 *
 * ⚠️  CONVENTION : les modèles utilisés (feature keys: "chat", "chat_guard") sont
 * configurables depuis le panel admin (app/(admin)/index.tsx). Si tu ajoutes une
 * étape IA ici, déclare-la dans src/admin/index.ts AI_FEATURES.
 */
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  streamText,
} from 'ai';

import { getRuntimeForFeature } from '@/ai/providers/featureRuntime';
import { getPromptTemplate } from '@/ai/prompts/promptStore';
import { logInteraction, type IntentCategory } from '@/ai/logging/logInteraction';
import { checkChatRateLimit } from '@/ai/rateLimit/chatRateLimit';
import { saveAssistantMessageServer } from '@/chat/serverHistory';
import { createServerSupabaseClient } from '@/db/serverSupabase';
import { buildUserContextSection, type ChatbotId } from '@/ai/chat/chatContext';
import type { PersonalInfo } from '@/profile/personalInfo';
import type { ServerPersonaResolution } from '@/ai/routing/serverPersona';
import { runInputGuard, extractLastUserText } from './guard';
import { guardMode, type GuardMode } from './guard/config';
import { createGuardLlmCheck } from './guard/llmStage2';
import { buildRefusalText } from './guard/refusalMessage';
import type { GuardVerdict } from './guard/types';

export interface ChatPipelineInput {
  request: Request;
  uiMessages: unknown[];
  chatbot: ChatbotId;
  resolution: ServerPersonaResolution;
  personalInfo: PersonalInfo | null;
  conversationId: string | null;
  startMs: number;
}

/** Dépendances injectables (tests) — les défauts sont les implémentations réelles. */
export interface ChatPipelineDeps {
  guardMode: () => GuardMode;
  runInputGuard: typeof runInputGuard;
  createGuardLlmCheck: typeof createGuardLlmCheck | (() => undefined);
  checkChatRateLimit: typeof checkChatRateLimit;
  getPromptTemplate: typeof getPromptTemplate;
  getRuntimeForFeature: typeof getRuntimeForFeature;
  streamTextImpl: typeof streamText;
  saveAssistantMessage: typeof saveAssistantMessageServer;
  createSupabase: typeof createServerSupabaseClient;
  logInteraction: typeof logInteraction;
  now: () => number;
}

const DEFAULT_DEPS: ChatPipelineDeps = {
  guardMode,
  runInputGuard,
  createGuardLlmCheck,
  checkChatRateLimit,
  getPromptTemplate,
  getRuntimeForFeature,
  streamTextImpl: streamText,
  saveAssistantMessage: saveAssistantMessageServer,
  createSupabase: createServerSupabaseClient,
  logInteraction,
  now: () => Date.now(),
};

/** Mappe une catégorie de garde vers l'enum ai_interactions (pas d'out_of_scope en base). */
function toIntentCategory(verdict: GuardVerdict | null): IntentCategory {
  if (!verdict) return 'general_info';
  if (verdict.category === 'out_of_scope') return 'general_info';
  return verdict.category;
}

/** Émet un refus comme mini-stream UIMessage complet (framing start/finish inclus). */
function refusalResponse(text: string): Response {
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      const id = generateId();
      writer.write({ type: 'start' });
      writer.write({ type: 'text-start', id });
      writer.write({ type: 'text-delta', id, delta: text });
      writer.write({ type: 'text-end', id });
      writer.write({ type: 'finish' });
    },
  });
  return createUIMessageStreamResponse({ stream });
}

export async function runChatPipeline(
  input: ChatPipelineInput,
  overrides: Partial<ChatPipelineDeps> = {},
): Promise<Response> {
  const deps: ChatPipelineDeps = { ...DEFAULT_DEPS, ...overrides };
  const { request, uiMessages, chatbot, resolution, personalInfo, conversationId, startMs } = input;

  // ── Couche 1 : garde d'entrée (dernier message utilisateur uniquement) ──────
  const mode = deps.guardMode();
  let verdict: GuardVerdict | null = null;
  if (mode !== 'off') {
    verdict = await deps.runInputGuard(extractLastUserText(uiMessages), {
      allowFictiveEducationalCases: resolution.persona === 'student',
      llmCheck: deps.createGuardLlmCheck() ?? undefined,
    });
  }

  if (verdict?.blocked && mode === 'enforce') {
    const refusalText = buildRefusalText(verdict.category, {
      reformulations: verdict.reformulations,
    });

    // Archivage du refus (sinon la reprise depuis l'historique le perdrait).
    if (conversationId && resolution.userId) {
      const supabase = deps.createSupabase();
      if (supabase) {
        await deps.saveAssistantMessage(supabase, {
          conversationId,
          userId: resolution.userId,
          content: refusalText,
        });
      }
    }

    await deps.logInteraction({
      persona: chatbot,
      model_used: verdict.layer === 'llm' ? 'chat_guard' : 'guard_regex',
      latency_ms: deps.now() - startMs,
      refusal_triggered: true,
      guardrail_layer: 'classifier',
      intent_category: toIntentCategory(verdict),
    });

    return refusalResponse(refusalText);
  }

  // ── Rate-limit (après la garde : un refus ne consomme pas de quota) ─────────
  const limit = await deps.checkChatRateLimit(request, resolution.persona ?? 'public');
  if (!limit.allowed) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((new Date(limit.resetAt).getTime() - deps.now()) / 1000),
    );
    return new Response(
      JSON.stringify({
        error: 'rate_limited',
        message: 'Quota quotidien de messages atteint. Réessayez après la réinitialisation.',
        daily_limit: limit.dailyLimit,
        remaining: 0,
        reset_at: limit.resetAt,
      }),
      {
        status: 429,
        headers: {
          'content-type': 'application/json',
          'retry-after': String(retryAfterSeconds),
        },
      },
    );
  }

  // ── LLM principal streamé (inchangé fonctionnellement depuis ADR-0024) ──────
  const [template, runtime] = await Promise.all([
    deps.getPromptTemplate(chatbot),
    // Recherche web ON par défaut pour le chat : les prompts v3 exigent des
    // sources réelles vérifiables (HAS/ESC/PubMed…).
    deps.getRuntimeForFeature('chat', { webSearch: true }),
  ]);

  const system = `${template}${buildUserContextSection(personalInfo)}`;
  const modelMessages = await convertToModelMessages(uiMessages as never);
  const { tools: webTools, ...callOptions } = runtime.options;

  const result = deps.streamTextImpl({
    model: runtime.model,
    system,
    messages: modelMessages,
    ...(webTools ? { tools: webTools } : {}),
    ...callOptions,
    onFinish: async ({ text, usage }) => {
      if (conversationId && resolution.userId) {
        const supabase = deps.createSupabase();
        if (supabase) {
          await deps.saveAssistantMessage(supabase, {
            conversationId,
            userId: resolution.userId,
            content: text,
          });
        }
      }
      await deps.logInteraction({
        persona: chatbot,
        model_used: runtime.modelId,
        tokens_in: usage?.inputTokens,
        tokens_out: usage?.outputTokens,
        latency_ms: deps.now() - startMs,
        refusal_triggered: false,
        // Mode observation : un verdict bloquant journalisé sans bloquer se lit
        // « guardrail_layer=classifier + refusal_triggered=false » = aurait refusé.
        guardrail_layer: verdict?.blocked ? 'classifier' : 'none',
        intent_category: toIntentCategory(verdict),
      });
    },
  });

  // Si le client se déconnecte en plein stream, la génération va au bout :
  // onFinish archive la réponse, récupérée depuis l'historique au retour.
  void result.consumeStream();

  return result.toUIMessageStreamResponse();
}
