/**
 * POST /api/presentation — Mode IA du générateur de présentations médicales.
 *
 * Le « médecin senior » co-construit un deck spec (JSON pivot) : il renvoie un court
 * message en français PUIS un bloc ```json contenant le deck complet régénéré. Le
 * rendu PPTX et l'aperçu se font 100 % côté client (public/presentation.html) ; cette
 * route n'archive RIEN (un deck est un support, pas un dossier patient).
 *
 * Sécurité (ADR-0018) : outil réservé aux comptes vérifiés étudiant / professionnel
 * (et admins). L'autorisation est dérivée du PROFIL VÉRIFIÉ côté serveur
 * (resolveChatPersona), jamais du body. Le masquage d'onglet n'est pas l'unique barrière.
 *
 * ⚠️  CONVENTION : le modèle utilisé (feature key: "presentation_generate") est
 * configurable depuis le panel admin (app/(admin)/index.tsx). Si tu ajoutes une étape
 * IA ici, déclare-la dans src/admin/index.ts AI_FEATURES.
 */
import { generateText } from 'ai';

import { isAdminUserId } from '@/admin/index';
import { getRuntimeForFeature } from '@/ai/providers/featureRuntime';
import { getPromptTemplate } from '@/ai/prompts/promptStore';
import { resolveChatPersona } from '@/ai/routing/serverPersona';
import { checkChatRateLimit } from '@/ai/rateLimit/chatRateLimit';
import {
  buildPresentationContextSection,
  coercePresentationOptions,
} from '@/presentation/presentationPrompt';

interface PresentationMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Garde-fous de payload (le contenu reste de l'information médicale générale). */
const MAX_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 8_000;

function coerceMessages(raw: unknown): PresentationMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m): m is { role?: unknown; content?: unknown } => !!m && typeof m === 'object')
    .map((m) => ({
      role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: typeof m.content === 'string' ? m.content.slice(0, MAX_MESSAGE_CHARS) : '',
    }))
    .filter((m) => m.content.length > 0)
    .slice(-MAX_MESSAGES);
}

export async function POST(request: Request): Promise<Response> {
  // Quota technique (réutilise le compteur étudiant) — aucune donnée de message stockée.
  const rateLimit = await checkChatRateLimit(request, 'student');
  if (!rateLimit.allowed) {
    return Response.json({ error: 'Limite de générations atteinte pour aujourd\'hui.' }, { status: 429 });
  }

  // Persona EFFECTIVE dérivée du profil vérifié (jamais du body) — réservé étudiant/pro/admin.
  const resolution = await resolveChatPersona(request, null);
  const isAdmin = resolution.userId ? isAdminUserId(resolution.userId) : false;
  const allowed = isAdmin || resolution.persona === 'student' || resolution.persona === 'professional';
  if (!allowed) {
    return Response.json(
      { error: 'Outil réservé aux comptes vérifiés étudiant ou professionnel de santé.' },
      { status: 403 },
    );
  }

  let body: { messages?: unknown; deck?: unknown; options?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'JSON invalide.' }, { status: 400 });
  }

  const messages = coerceMessages(body.messages);
  if (messages.length === 0) {
    return Response.json({ error: 'Aucun message.' }, { status: 400 });
  }

  const options = coercePresentationOptions(body.options);

  const [template, runtime] = await Promise.all([
    getPromptTemplate('presentation_generate'),
    getRuntimeForFeature('presentation_generate'),
  ]);

  const system = `${template}${buildPresentationContextSection(options, body.deck)}`;

  try {
    const { text } = await generateText({
      model: runtime.model,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      ...runtime.options,
    });
    return Response.json({ text });
  } catch (e) {
    console.error('Presentation generation error:', e);
    return Response.json({ error: 'Échec de la génération de la présentation.' }, { status: 502 });
  }
}
