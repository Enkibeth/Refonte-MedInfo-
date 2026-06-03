/**
 * Route API chat — POST /api/chat (Expo Router API route, web).
 * Defense-in-depth 3 couches (01_REGULATION §4, 04_CHATBOT §4) :
 *   Couche 1 : classifieur d'intention (pré-LLM, déterministe)
 *   Couche 2 : contrainte prompt (system prompt public.v2)
 *   Couche 3 : validation de sortie (marqueurs diagnostiques) dans onFinish
 * Logging ai_interactions (service_role, aucune donnée santé identifiable).
 */
import { streamText, convertToModelMessages } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

import { runClassifierGate } from '@/ai/classifier/gate';
import { getActivePrompt } from '@/ai/prompts/index';
import { validateOutput } from '@/ai/guardrails/outputValidator';
import { logInteraction } from '@/ai/logging/logInteraction';
import { CANONICAL_REFUSAL } from '@/compliance/disclosures';
import { proposeFollowupsTool } from '@/ai/skills/propose_followups';
import { showSourcesTool } from '@/ai/skills/show_sources';
import { refuseAndRedirectTool } from '@/ai/skills/refuse_and_redirect';
import type { Persona } from '@/ai/prompts/_schema';
import type { IntentCategory } from '@/ai/classifier/types';

const VALID_PERSONAS: Persona[] = ['public', 'student'];

function getToolsForPersona(_persona: Persona) {
  // Matrice 04_CHATBOT §8 : public = 3 tools (render_qcm student only, étape 6)
  return {
    propose_followups: proposeFollowupsTool,
    show_sources: showSourcesTool,
    refuse_and_redirect: refuseAndRedirectTool,
  };
}

export async function POST(request: Request): Promise<Response> {
  const startMs = Date.now();

  let body: { messages?: unknown[]; persona?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const rawPersona = body.persona;
  const persona: Persona =
    typeof rawPersona === 'string' && (VALID_PERSONAS as string[]).includes(rawPersona)
      ? (rawPersona as Persona)
      : 'public';

  const uiMessages = Array.isArray(body.messages) ? body.messages : [];

  // Dernier message utilisateur pour le classifieur
  const lastUserMessage = uiMessages.findLast(
    (m: any) => m.role === 'user',
  ) as any;
  const userText: string =
    typeof lastUserMessage?.content === 'string'
      ? lastUserMessage.content
      : lastUserMessage?.parts?.find((p: any) => p.type === 'text')?.text ?? '';

  // ── Couche 1 : classifieur d'intention (pré-LLM, déterministe) ────────────
  const gateOutcome = await runClassifierGate(userText);

  if (gateOutcome.action !== 'route_main_llm') {
    await logInteraction({
      persona,
      model_used: 'none',
      latency_ms: Date.now() - startMs,
      refusal_triggered: true,
      guardrail_layer: 'classifier',
      intent_category: gateOutcome.category as IntentCategory,
    });

    return new Response(
      JSON.stringify({
        type: 'refusal',
        message: CANONICAL_REFUSAL,
        intent_category: gateOutcome.category,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // ── Couches 2 & 3 : LLM + validation de sortie ────────────────────────────
  const prompt = getActivePrompt(persona);
  const modelMessages = await convertToModelMessages(uiMessages as any);

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: prompt.template,
    messages: modelMessages,
    tools: getToolsForPersona(persona),
    onFinish: async ({ text, usage }) => {
      // Couche 3 : validation de sortie (marqueurs diagnostiques)
      const validation = validateOutput(text);

      await logInteraction({
        persona,
        model_used: prompt.model_default,
        tokens_in: usage?.inputTokens,
        tokens_out: usage?.outputTokens,
        latency_ms: Date.now() - startMs,
        refusal_triggered: validation.blocked,
        guardrail_layer: validation.blocked ? 'output_validation' : 'none',
        intent_category: 'general_info',
      });
    },
  });

  return result.toUIMessageStreamResponse();
}
