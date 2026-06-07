/**
 * POST /api/ecos — Simulation patient ECOS, évaluation, et génération de cas fictif.
 *
 * Modes : "simulate" (défaut, streamé), "evaluate", "generate" (import d'une station
 * → cas ECOS FICTIF, ADR-0017/0020).
 *
 * ⚠️  CONVENTION : les modèles utilisés (ecos_simulate, ecos_evaluate, ecos_generate)
 * sont configurables depuis le panel admin (app/(admin)/index.tsx).
 * Si tu ajoutes un mode IA ici, déclare-le dans src/admin/index.ts AI_FEATURES.
 */
import { streamText, generateText } from 'ai';
import { getRuntimeForFeature } from '@/ai/providers/featureRuntime';
import { getPromptTemplate } from '@/ai/prompts/promptStore';
import { checkChatRateLimit } from '@/ai/rateLimit/chatRateLimit';

interface EcosMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Extrait le premier objet JSON d'un texte LLM (tolère les ```json fences). */
function extractJson(text: string): Record<string, unknown> | null {
  if (!text) return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function POST(request: Request): Promise<Response> {
  const rateLimit = await checkChatRateLimit(request, 'student');
  if (!rateLimit.allowed) {
    return Response.json({ error: 'Limite de messages atteinte.' }, { status: 429 });
  }

  let body: {
    mode?: string;
    systemPrompt?: string;
    messages?: EcosMessage[];
    sourceText?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'JSON invalide.' }, { status: 400 });
  }

  const { mode = 'simulate', systemPrompt, messages = [], sourceText } = body;

  // ── Mode "generate" — import d'une station → cas ECOS FICTIF ────────────────
  // Pas de systemPrompt attendu (la consigne vient du prompt ecos_generate).
  if (mode === 'generate') {
    const source = typeof sourceText === 'string' ? sourceText.trim() : '';
    if (!source) {
      return Response.json({ error: 'sourceText requis.' }, { status: 400 });
    }
    if (source.length > 12000) {
      return Response.json({ error: 'Texte trop long (max 12000 caractères).' }, { status: 413 });
    }

    const [genPrompt, runtime] = await Promise.all([
      getPromptTemplate('ecos_generate'),
      getRuntimeForFeature('ecos_generate'),
    ]);

    try {
      const { text } = await generateText({
        model: runtime.model,
        system: genPrompt,
        messages: [{ role: 'user', content: source }],
        ...runtime.options,
      });

      const parsed = extractJson(text);
      if (!parsed) {
        return Response.json({ error: 'Génération illisible. Réessayez.' }, { status: 422 });
      }
      // Le prompt renvoie {error} s'il refuse (dossier réel suspecté).
      if (typeof parsed.error === 'string') {
        return Response.json({ error: parsed.error }, { status: 422 });
      }
      return Response.json({ case: parsed });
    } catch (e) {
      console.error('ECOS generate error:', e);
      return Response.json({ error: 'Échec de la génération du cas.' }, { status: 502 });
    }
  }

  if (!systemPrompt || typeof systemPrompt !== 'string') {
    return Response.json({ error: 'systemPrompt requis.' }, { status: 400 });
  }
  if (systemPrompt.length > 4000) {
    return Response.json({ error: 'systemPrompt trop long.' }, { status: 400 });
  }

  if (mode === 'evaluate') {
    const [evalPromptSuffix, runtime] = await Promise.all([
      getPromptTemplate('ecos_evaluate'),
      getRuntimeForFeature('ecos_evaluate'),
    ]);

    const combinedSystem = `${systemPrompt}\n\n${evalPromptSuffix}`;

    try {
      const { text } = await generateText({
        model: runtime.model,
        system: combinedSystem,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        ...runtime.options,
      });
      return Response.json({ evaluation: text });
    } catch (e) {
      console.error('ECOS evaluation error:', e);
      return Response.json({ error: 'Échec de l\'évaluation.' }, { status: 502 });
    }
  }

  // Mode simulate — streamed
  try {
    const runtime = await getRuntimeForFeature('ecos_simulate');
    const result = streamText({
      model: runtime.model,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      ...runtime.options,
    });
    return result.toTextStreamResponse();
  } catch (e) {
    console.error('ECOS simulate error:', e);
    return Response.json({ error: 'Échec de la simulation.' }, { status: 502 });
  }
}
