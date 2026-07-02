/**
 * Route API chat — POST /api/chat (Expo Router API route, web).
 *
 * ADR-0029 (réintroduction sécurité) : la route reste mince — parse du body,
 * persona vérifiée côté serveur, verrou essai invité — et délègue au pipeline
 * (src/ai/chat/pipeline.ts) : garde d'entrée → rate-limit → LLM streamé → archivage.
 *
 *   - 3 chatbots = 3 prompts produit complets (public.v3 / student.v3 / professional.v2),
 *     éditables depuis le panel admin (table ai_prompts, fallback PROMPT_DEFAULTS).
 *   - Le client choisit son chatbot (`body.chatbot`) ; côté serveur, seuls les comptes
 *     vérifiés étudiant/professionnel (et admins) peuvent utiliser les chats étudiant/pro.
 *   - Contexte utilisateur (prénom/âge/sexe) injecté depuis le profil.
 *
 * ⚠️  CONVENTION : les modèles utilisés (feature keys: "chat", "chat_guard") sont
 * configurables depuis le panel admin (app/(admin)/index.tsx). Si tu ajoutes une
 * étape IA ici, déclare-la dans src/admin/index.ts AI_FEATURES.
 */
import { resolveChatPersona } from '@/ai/routing/serverPersona';
import { coerceConversationId } from '@/chat/serverHistory';
import { runChatPipeline } from '@/ai/chat/pipeline';
import { coerceChatbot, coercePersonalInfo, type ChatbotId } from '@/ai/chat/chatContext';
import type { Persona } from '@/ai/prompts/_schema';

/**
 * Chatbots autorisés selon la persona vérifiée du compte.
 * Essai sans inscription (2026-06) : un visiteur anonyme découvre les 3 chatbots
 * (`guestTrial`), mais il est limité à UN message utilisateur (voir POST ci-dessous).
 */
export function allowedChatbotsFor(
  persona: Persona | null,
  opts: { guestTrial?: boolean } = {},
): ChatbotId[] {
  if (opts.guestTrial || persona === 'student' || persona === 'professional') {
    return ['public', 'student', 'professional'];
  }
  return ['public'];
}

/** Nombre maximal de messages utilisateur d'une conversation anonyme (essai gratuit). */
export const GUEST_TRIAL_MAX_USER_MESSAGES = 1;

export async function POST(request: Request): Promise<Response> {
  const startMs = Date.now();

  let body: {
    messages?: unknown[];
    chatbot?: unknown;
    personalInfo?: unknown;
    conversationId?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const uiMessages = Array.isArray(body.messages) ? body.messages : [];
  const personalInfo = coercePersonalInfo(body.personalInfo);

  // Persona vérifiée côté serveur (token → profil). Le body ne donne JAMAIS de droits :
  // il exprime seulement quel chatbot l'utilisateur veut utiliser, parmi ceux autorisés.
  const resolution = await resolveChatPersona(request, body.chatbot);

  // Essai sans inscription : un appel anonyme n'a droit qu'à UN message utilisateur.
  // L'indicateur 1/1 → 0/1 vit côté client ; ce verrou serveur empêche de poursuivre
  // une conversation anonyme en rejouant la requête avec un historique plus long.
  if (!resolution.verified) {
    const userMessageCount = uiMessages.filter(
      (m) => (m as { role?: unknown }).role === 'user',
    ).length;
    if (userMessageCount > GUEST_TRIAL_MAX_USER_MESSAGES) {
      return new Response(
        JSON.stringify({
          error: 'signup_required',
          message: 'Créez un compte gratuit ou connectez-vous pour continuer la conversation.',
        }),
        { status: 401, headers: { 'content-type': 'application/json' } },
      );
    }
  }

  const requestedChatbot = coerceChatbot(body.chatbot);
  const allowed = allowedChatbotsFor(resolution.persona, { guestTrial: !resolution.verified });
  const chatbot: ChatbotId = allowed.includes(requestedChatbot) ? requestedChatbot : 'public';

  // Archivage serveur (résilience hors-ligne) : uniquement pour un compte vérifié,
  // propriété de la conversation vérifiée contre le user du token, jamais le body.
  const conversationId =
    resolution.verified && resolution.userId ? coerceConversationId(body.conversationId) : null;

  return runChatPipeline({
    request,
    uiMessages,
    chatbot,
    resolution,
    personalInfo,
    conversationId,
    startMs,
  });
}
