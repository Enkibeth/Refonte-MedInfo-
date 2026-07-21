/**
 * POST /api/ecos — Simulation patient ECOS et évaluation.
 *
 * ⚠️  CONVENTION : les modèles utilisés (ecos_simulate, ecos_evaluate) sont
 * configurables depuis le panel admin (app/(admin)/index.tsx).
 * Si tu ajoutes un mode IA ici, déclare-le dans src/admin/index.ts AI_FEATURES.
 */
import { streamText, generateText } from 'ai';
import { getRuntimeForFeature } from '@/ai/providers/featureRuntime';
import { getPromptTemplate } from '@/ai/prompts/promptStore';
import { checkChatRateLimit } from '@/ai/rateLimit/chatRateLimit';
import { logFeatureUsage } from '@/ai/logging/logFeatureUsage';

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
    const [evalPromptSuffix, runtime] = await Promise.all([
      getPromptTemplate('ecos_evaluate'),
      getRuntimeForFeature('ecos_evaluate'),
    ]);

    const combinedSystem = `${systemPrompt}\n\n${evalPromptSuffix}`;

    try {
      const { text, usage } = await generateText({
        model: runtime.model,
        system: combinedSystem,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        ...runtime.options,
      });
      logFeatureUsage({ feature: 'ecos_evaluate', modelId: runtime.modelId, usage });
      return Response.json({ evaluation: text });
    } catch (e) {
      console.error('ECOS evaluation error:', e);
      return Response.json({ error: 'Échec de l\'évaluation.' }, { status: 502 });
    }
  }

  // Mode simulate — streamed.
  // Les RÈGLES de comportement du patient (anti « faux positif » : ne répondre qu'à ce
  // qui est précisément demandé) vivent dans le prompt serveur `ecos_patient` (promptStore,
  // éditable panel admin), PAS dans le body client : le `systemPrompt` reçu n'est que la
  // fiche de rôle du cas (identité/symptômes/éléments à révéler).
  try {
    const [patientRules, runtime] = await Promise.all([
      getPromptTemplate('ecos_patient'),
      getRuntimeForFeature('ecos_simulate'),
    ]);
    const combinedSystem = patientRules
      ? `${patientRules}\n\n═══ FICHE DE RÔLE DU CAS ═══\n${systemPrompt}`
      : systemPrompt;
    const result = streamText({
      model: runtime.model,
      system: combinedSystem,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      ...runtime.options,
      onFinish: ({ usage }) => {
        logFeatureUsage({ feature: 'ecos_simulate', modelId: runtime.modelId, usage });
      },
    });
    return result.toTextStreamResponse();
  } catch (e) {
    console.error('ECOS simulate error:', e);
    return Response.json({ error: 'Échec de la simulation.' }, { status: 502 });
  }
}
