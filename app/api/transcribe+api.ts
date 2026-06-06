/**
 * POST /api/transcribe — Transcription audio via OpenAI Whisper.
 * Requiert multipart/form-data avec un champ "audio" (Blob) et "mode" (transcription|report).
 * Mode "report" génère en plus un compte rendu médical structuré depuis la transcription.
 */
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

const MAX_SIZE_BYTES = 25 * 1024 * 1024;

const REPORT_SYSTEM = `Tu es un assistant médical expert en rédaction. À partir d'une transcription audio (dictée ou consultation), génère un compte rendu médical structuré, professionnel et factuel en français, au format markdown. Adapte les sections au contenu (motif, anamnèse, examen clinique, conclusion, conduite à tenir…). N'utilise que les informations de la transcription.`;

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

  // Whisper API via fetch direct
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whisperForm: any = new FormData();
  whisperForm.append('file', audioEntry, 'audio.webm');
  whisperForm.append('model', 'whisper-1');
  whisperForm.append('language', 'fr');
  whisperForm.append('response_format', 'text');

  let transcription: string;
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

    transcription = (await whisperRes.text()).trim();
  } catch (e) {
    console.error('Whisper fetch error:', e);
    return Response.json({ error: 'Erreur réseau lors de la transcription.' }, { status: 502 });
  }

  if (!transcription) {
    return Response.json({ error: 'Aucun contenu audio détecté.' }, { status: 422 });
  }

  if (mode !== 'report') {
    return Response.json({ transcription });
  }

  // Mode report : génère un compte rendu structuré
  try {
    const model = openai('gpt-4o-mini');
    const { text: report } = await generateText({
      model,
      system: REPORT_SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Voici la transcription audio à mettre en forme en compte rendu médical :\n\n${transcription}`,
        },
      ],
    });

    return Response.json({ transcription, report });
  } catch (e) {
    console.error('Report generation error:', e);
    return Response.json({ transcription, report: null });
  }
}
