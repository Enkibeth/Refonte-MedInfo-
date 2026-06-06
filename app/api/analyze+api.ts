/**
 * POST /api/analyze — Analyse de document médical.
 * Génère un résumé patient structuré depuis un texte de document médical.
 * Streamed (text/plain chunks).
 */
import { streamText } from 'ai';
import { getActiveModel } from '@/ai/providers/index';
import { checkChatRateLimit } from '@/ai/rateLimit/chatRateLimit';

const SYSTEM = `Tu es un assistant médical pédagogique. L'utilisateur te fournit un document médical (compte rendu, ordonnance, résultats d'analyse, lettre de consultation).

Génère un résumé structuré en markdown pour un patient non médecin :

## Ce que dit ce document
Résumé clair et simple du contenu principal (3-5 phrases, sans jargon).

## Termes médicaux expliqués
Liste (- **Terme** : explication simple) pour chaque terme technique important.

## Questions à poser à votre médecin
4 à 6 questions pertinentes que le patient devrait poser.

## Points importants à retenir
Les 2 à 3 informations essentielles à ne pas oublier.

---
*Ce résumé est informatif et ne remplace pas une consultation médicale.*

Règles : langage clair, jamais d'interprétation clinique, jamais d'avis médical.`;

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
    const result = streamText({
      model: getActiveModel(),
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Voici le document médical à analyser :\n\n${truncated}`,
        },
      ],
    });

    return result.toTextStreamResponse();
  } catch (e) {
    console.error('Analyze error:', e);
    return Response.json({ error: 'Analyse impossible pour le moment.' }, { status: 502 });
  }
}
