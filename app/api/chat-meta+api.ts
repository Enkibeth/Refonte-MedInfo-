/**
 * Route API chat-meta — POST /api/chat-meta.
 * Génère le TITRE et la CATÉGORIE d'une conversation pour l'historique des chats,
 * à partir du premier échange (message utilisateur + début de réponse de l'IA).
 *
 * ⚠️  CONVENTION : le modèle utilisé (feature key: "chat_meta", défaut Gemini 2.5 Flash)
 * est configurable depuis le panel admin (app/(admin)/index.tsx).
 * Si tu ajoutes une étape IA ici, déclare-la dans src/admin/index.ts AI_FEATURES.
 */
import { generateObject } from 'ai';
import { z } from 'zod';

import { getRuntimeForFeature } from '@/ai/providers/featureRuntime';
import { getPromptTemplate } from '@/ai/prompts/promptStore';
import { resolveVerifiedUserId } from '@/auth/serverIdentity';
import { createServerSupabaseClient } from '@/db/serverSupabase';

export const CHAT_CATEGORIES = [
  'Symptômes',
  'Médicaments',
  'Examens & analyses',
  'Maladies & pathologies',
  'Prévention & dépistage',
  'Grossesse & enfant',
  'Révisions & concours',
  'Cas clinique',
  'Administratif & rendez-vous',
  'Autre',
] as const;

const metaSchema = z.object({
  title: z.string().min(1).max(80),
  category: z.enum(CHAT_CATEGORIES),
});

export async function POST(request: Request): Promise<Response> {
  let body: { userText?: unknown; assistantText?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Réservé aux comptes connectés : l'historique est un service du compte.
  const supabase = createServerSupabaseClient();
  const userId = supabase ? await resolveVerifiedUserId(request, supabase) : null;
  if (!userId) return Response.json({ error: 'Non authentifié.' }, { status: 401 });

  const userText = typeof body.userText === 'string' ? body.userText.slice(0, 2000) : '';
  const assistantText = typeof body.assistantText === 'string' ? body.assistantText.slice(0, 2000) : '';
  if (!userText.trim()) return Response.json({ error: 'userText requis.' }, { status: 400 });

  try {
    const [system, runtime] = await Promise.all([
      getPromptTemplate('chat_meta'),
      getRuntimeForFeature('chat_meta'),
    ]);
    const { tools: _tools, ...callOptions } = runtime.options;

    const { object } = await generateObject({
      model: runtime.model,
      system,
      schema: metaSchema,
      prompt:
        `Premier message de l'utilisateur :\n"""${userText}"""\n\n` +
        (assistantText ? `Début de la réponse de l'assistant :\n"""${assistantText}"""\n` : ''),
      ...callOptions,
    });

    return Response.json(object);
  } catch (e) {
    // Repli déterministe : jamais d'échec bloquant pour une simple métadonnée.
    const fallbackTitle = userText.trim().split(/\s+/).slice(0, 7).join(' ').slice(0, 60);
    console.warn('[chat-meta] generation failed, falling back', e);
    return Response.json({ title: fallbackTitle || 'Nouvelle conversation', category: 'Autre' });
  }
}
