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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Valide un id de conversation transmis par le client (uuid, sinon null). */
export function coerceConversationId(value: unknown): string | null {
  return typeof value === 'string' && UUID_RE.test(value) ? value : null;
}

/**
 * Archive la réponse de l'assistant dans `chat_messages` si — et seulement si — la
 * conversation appartient au user vérifié. Échec silencieux : l'archivage ne doit
 * jamais casser la réponse du chat.
 *
 * `replaceLast` (régénération) : la réponse déjà archivée pour CE tour est supprimée avant
 * l'insertion — sinon la conversation rouverte montrerait l'ancienne ET la nouvelle réponse
 * à la suite. Seulement si le dernier message archivé est bien une réponse : quand c'est la
 * question (tour resté sans réponse — réflexion épuisée, flux coupé), il n'y a rien à
 * remplacer, et supprimer « la dernière réponse assistant » effaçait celle du tour d'AVANT.
 */
export async function saveAssistantMessageServer(
  supabase: SupabaseClient,
  {
    conversationId,
    userId,
    content,
    replaceLast = false,
  }: { conversationId: string; userId: string; content: string; replaceLast?: boolean },
): Promise<void> {
  if (!content.trim()) return;
  try {
    const { data: conv } = await supabase
      .from('chat_conversations')
      .select('user_id')
      .eq('id', conversationId)
      .maybeSingle();
    if (!conv || (conv as { user_id?: string }).user_id !== userId) return;

    if (replaceLast) {
      const { data: last } = await supabase
        .from('chat_messages')
        .select('id, role')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const row = last as { id?: string; role?: string } | null;
      if (row?.id && row.role === 'assistant') {
        await supabase.from('chat_messages').delete().eq('id', row.id);
      }
    }

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
