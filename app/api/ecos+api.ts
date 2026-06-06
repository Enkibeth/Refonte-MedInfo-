/**
 * POST /api/ecos — Simulation patient ECOS et évaluation.
 *
 * ⚠️  CONVENTION : les modèles utilisés (ecos_simulate, ecos_evaluate) sont
 * configurables depuis le panel admin (app/(admin)/index.tsx).
 * Si tu ajoutes un mode IA ici, déclare-le dans src/admin/index.ts AI_FEATURES.
 */
import { streamText, generateText } from 'ai';
import { getModelForFeature } from '@/ai/providers/featureModel';
import { getPromptTemplate } from '@/ai/prompts/promptStore';
import { checkChatRateLimit } from '@/ai/rateLimit/chatRateLimit';

interface EcosMessage {
  role: 'user' | 'assistant';
  content: string;
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
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'JSON invalide.' }, { status: 400 });
  }

  const { mode = 'simulate', systemPrompt, messages = [] } = body;

  if (!systemPrompt || typeof systemPrompt !== 'string') {
    return Response.json({ error: 'systemPrompt requis.' }, { status: 400 });
  }
  if (systemPrompt.length > 4000) {
    return Response.json({ error: 'systemPrompt trop long.' }, { status: 400 });
  }

  if (mode === 'evaluate') {
    const [evalPromptSuffix, model] = await Promise.all([
      getPromptTemplate('ecos_evaluate'),
      getModelForFeature('ecos_evaluate'),
    ]);

    const combinedSystem = `${systemPrompt}\n\n${evalPromptSuffix}`;

    try {
      const { text } = await generateText({
        model,
        system: combinedSystem,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      });
      return Response.json({ evaluation: text });
    } catch (e) {
      console.error('ECOS evaluation error:', e);
      return Response.json({ error: 'Échec de l\'évaluation.' }, { status: 502 });
    }
  }

  // Mode simulate — streamed
  try {
    const model = await getModelForFeature('ecos_simulate');
    const result = streamText({
      model,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });
    return result.toTextStreamResponse();
  } catch (e) {
    console.error('ECOS simulate error:', e);
    return Response.json({ error: 'Échec de la simulation.' }, { status: 502 });
  }
}
