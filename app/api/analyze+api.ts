/**
 * POST /api/analyze — Analyse de document médical (streaming).
 *
 * ⚠️  CONVENTION : le modèle utilisé (feature key: "analyze") est configurable
 * depuis le panel admin (app/(admin)/index.tsx).
 * Si tu ajoutes une étape IA ici, déclare-la dans src/admin/index.ts AI_FEATURES.
 */
import { streamText } from 'ai';
import { getRuntimeForFeature } from '@/ai/providers/featureRuntime';
import { getPromptTemplate } from '@/ai/prompts/promptStore';
import { checkChatRateLimit } from '@/ai/rateLimit/chatRateLimit';

const MAX_DOC_LENGTH = 8000;

export async function POST(request: Request): Promise<Response> {
  const rateLimit = await checkChatRateLimit(request, 'public');
  if (!rateLimit.allowed) {
    return Response.json({ error: 'Limite de requêtes atteinte.' }, { status: 429 });
  }

  let body: { documentText?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'JSON invalide.' }, { status: 400 });
  }

  const documentText = body.documentText?.trim() ?? '';
  if (documentText.length < 20) {
    return Response.json({ error: 'Document trop court (minimum 20 caractères).' }, { status: 400 });
  }

  const truncated = documentText.slice(0, MAX_DOC_LENGTH);

  try {
    const [runtime, systemPrompt] = await Promise.all([
      getRuntimeForFeature('analyze'),
      getPromptTemplate('analyze'),
    ]);

    const result = streamText({
      model: runtime.model,
      system: systemPrompt,
      messages: [
        { role: 'user', content: `Voici le document médical à analyser :\n\n${truncated}` },
      ],
      ...runtime.options,
    });

    return result.toTextStreamResponse();
  } catch (e) {
    console.error('Analyze error:', e);
    return Response.json({ error: 'Analyse impossible pour le moment.' }, { status: 502 });
  }
}
