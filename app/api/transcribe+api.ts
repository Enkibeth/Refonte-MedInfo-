/**
 * POST /api/transcribe — Pipeline audio en 3 étapes :
 *   1. Whisper (OpenAI) → transcription brute
 *   2. Diarisation GPT — labellise Médecin / Patient selon le contexte
 *   3. Compte rendu GPT (mode "report") → document médical structuré
 *
 * ⚠️  CONVENTION : les modèles utilisés (audio_diarize, audio_report) sont
 * configurables depuis le panel admin (app/(admin)/index.tsx).
 * Si tu ajoutes une étape IA ici, déclare-la dans src/admin/index.ts AI_FEATURES.
 */
import { generateText } from 'ai';
import { getRuntimeForFeature } from '@/ai/providers/featureRuntime';
import { getPromptTemplate } from '@/ai/prompts/promptStore';
import { sanitizeMedicalReport } from '@/ai/audio/sanitizeReport';

const MAX_SIZE_BYTES = 25 * 1024 * 1024;

export async function POST(request: Request): Promise<Response> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return Response.json(
      { error: 'Transcription non disponible : clé OpenAI non configurée.' },
      { status: 503 },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let incomingFormData: any;
  try {
    incomingFormData = await request.formData();
  } catch {
    return Response.json({ error: 'Requête multipart invalide.' }, { status: 400 });
  }

  const audioEntry = incomingFormData.get('audio');
  const mode = (incomingFormData.get('mode') as string | null) ?? 'transcription';

  if (!audioEntry || !(audioEntry instanceof Blob)) {
    return Response.json({ error: 'Champ "audio" manquant.' }, { status: 400 });
  }

  if (audioEntry.size > MAX_SIZE_BYTES) {
    return Response.json({ error: 'Fichier trop volumineux (max 25 MB).' }, { status: 413 });
  }

  // ── Étape 1 : Whisper transcription brute ─────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whisperForm: any = new FormData();
  whisperForm.append('file', audioEntry, 'audio.webm');
  whisperForm.append('model', 'whisper-1');
  whisperForm.append('language', 'fr');
  whisperForm.append('response_format', 'text');

  let rawTranscription: string;
  try {
    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}` },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      body: whisperForm as any,
    });

    if (!whisperRes.ok) {
      const err = await whisperRes.text();
      console.error('Whisper error:', err);
      return Response.json({ error: 'Échec de la transcription audio.' }, { status: 502 });
    }

    rawTranscription = (await whisperRes.text()).trim();
  } catch (e) {
    console.error('Whisper fetch error:', e);
    return Response.json({ error: 'Erreur réseau lors de la transcription.' }, { status: 502 });
  }

  if (!rawTranscription) {
    return Response.json({ error: 'Aucun contenu audio détecté.' }, { status: 422 });
  }

  // Mode "raw"/"dictation" (dictée vocale dans une zone de saisie) : on renvoie la
  // transcription BRUTE, sans diarisation Médecin/Patient (réservée au compte rendu pro).
  // Le texte dicté repasse ensuite par la safe-box normale de la route cible (ex. /api/chat).
  if (mode === 'raw' || mode === 'dictation') {
    return Response.json({ transcription: rawTranscription });
  }

  // ── Étape 2 : Diarisation — labellise Médecin / Patient ──────────────────
  let labelledTranscription = rawTranscription;
  try {
    const [diarizeRuntime, diarizePrompt] = await Promise.all([
      getRuntimeForFeature('audio_diarize'),
      getPromptTemplate('audio_diarize'),
    ]);

    const { text: labelled } = await generateText({
      model: diarizeRuntime.model,
      system: diarizePrompt,
      messages: [{ role: 'user', content: rawTranscription }],
      ...diarizeRuntime.options,
    });

    if (labelled.trim()) labelledTranscription = labelled.trim();
  } catch (e) {
    console.error('Diarisation error (non-bloquant):', e);
    // Fallback : on continue avec la transcription brute
  }

  if (mode !== 'report') {
    return Response.json({ transcription: labelledTranscription });
  }

  // ── Étape 3 : Génération du compte rendu depuis la transcription labellisée
  try {
    const [reportRuntime, reportPrompt] = await Promise.all([
      getRuntimeForFeature('audio_report'),
      getPromptTemplate('audio_report'),
    ]);

    const { text: report } = await generateText({
      model: reportRuntime.model,
      system: reportPrompt,
      ...reportRuntime.options,
      messages: [
        {
          role: 'user',
          content: `Voici la transcription labellisée de la consultation :\n\n${labelledTranscription}`,
        },
      ],
    });

    // Nettoyage : retrait des emojis/symboles décoratifs et normalisation markdown
    // pour un compte rendu médical sobre, propre et exportable en PDF.
    return Response.json({ transcription: labelledTranscription, report: sanitizeMedicalReport(report) });
  } catch (e) {
    console.error('Report generation error:', e);
    return Response.json({ transcription: labelledTranscription, report: null });
  }
}
