/**
 * POST /api/report — Rédaction d'un compte rendu médical structuré à partir de
 * NOTES TEXTE (dictées via la dictée vocale, collées ou importées) + un modèle de
 * CR choisi. Complément écrit du pipeline audio (/api/transcribe mode "report").
 *
 * ⚠️  CONVENTION : le modèle utilisé (feature key: "report_generate") est configurable
 * depuis le panel admin (app/(admin)/index.tsx).
 * Si tu ajoutes une étape IA ici, déclare-la dans src/admin/index.ts AI_FEATURES.
 */
import { generateText } from 'ai';
import { getRuntimeForFeature } from '@/ai/providers/featureRuntime';
import { getPromptTemplate } from '@/ai/prompts/promptStore';
import { buildTemplateInstruction } from '@/lib/reportTemplates';

const MAX_TEXT = 16000;

export async function POST(request: Request): Promise<Response> {
  let body: { text?: string; template?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'JSON invalide.' }, { status: 400 });
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const template = typeof body.template === 'string' ? body.template : 'auto';

  if (!text) {
    return Response.json({ error: 'Texte requis.' }, { status: 400 });
  }
  if (text.length > MAX_TEXT) {
    return Response.json(
      { error: `Texte trop long (max ${MAX_TEXT} caractères).` },
      { status: 413 },
    );
  }

  try {
    const [runtime, basePrompt] = await Promise.all([
      getRuntimeForFeature('report_generate'),
      getPromptTemplate('report_generate'),
    ]);

    const system = `${basePrompt}\n\n${buildTemplateInstruction(template)}`;

    const { text: report } = await generateText({
      model: runtime.model,
      system,
      messages: [{ role: 'user', content: `Notes du médecin :\n\n${text}` }],
      ...runtime.options,
    });

    return Response.json({ report });
  } catch (e) {
    console.error('Report generation error:', e);
    return Response.json({ error: 'Échec de la génération du compte rendu.' }, { status: 502 });
  }
}
