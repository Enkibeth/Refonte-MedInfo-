/**
 * Écriture serveur de l'historique du chat (complément de src/chat/history.ts, qui
 * reste le CRUD client own-row).
 *
 * Depuis la résilience hors-ligne (2026-06), c'est le SERVEUR qui archive la réponse
 * de l'assistant en fin de génération (`/api/chat` onFinish) : si l'utilisateur quitte
 * Safari/l'app pendant le streaming (iOS suspend la page et coupe le flux), la réponse
 * est quand même générée jusqu'au bout (consumeStream) et conservée — le client la
 * récupère depuis l'historique à son retour.
 *
 * Le client service_role contourne la RLS : la propriété de la conversation est donc
 * TOUJOURS vérifiée contre le user vérifié (jamais le body) avant toute écriture.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { coerceUuid } from '@/db/ids';

/** Valide un id de conversation transmis par le client (uuid, sinon null). */
export function coerceConversationId(value: unknown): string | null {
  return coerceUuid(value);
}

/**
 * Archive la réponse de l'assistant dans `chat_messages` si — et seulement si — la
 * conversation appartient au user vérifié. Échec silencieux : l'archivage ne doit
 * jamais casser la réponse du chat.
 */
export async function saveAssistantMessageServer(
  supabase: SupabaseClient,
  {
    conversationId,
    userId,
    content,
  }: { conversationId: string; userId: string; content: string },
): Promise<void> {
  if (!content.trim()) return;
  try {
    const { data: conv } = await supabase
      .from('chat_conversations')
      .select('user_id')
      .eq('id', conversationId)
      .maybeSingle();
    if (!conv || (conv as { user_id?: string }).user_id !== userId) return;

    await supabase
      .from('chat_messages')
      .insert({ conversation_id: conversationId, user_id: userId, role: 'assistant', content });
    await supabase
      .from('chat_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);
  } catch {
    // Archivage best-effort.
  }
}
