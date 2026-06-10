/**
 * Historique des conversations du chat (refonte 2026-06, migration 0020).
 *
 * CRUD client via supabase-js : la RLS own-row garantit que l'utilisateur ne voit
 * que SES conversations. Le titre et la catégorie sont générés par IA via
 * /api/chat-meta (feature "chat_meta", défaut Gemini 2.5 Flash) après le premier échange.
 */
import { getSupabaseClient } from '@/db/supabase';
import type { ChatbotId } from '@/ai/chat/chatContext';

export interface ChatConversation {
  id: string;
  chatbot: ChatbotId;
  title: string | null;
  category: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatHistoryMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export async function listConversations(userId: string): Promise<ChatConversation[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('chat_conversations')
    .select('id, chatbot, title, category, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(200);
  if (error || !data) return [];
  return data as ChatConversation[];
}

export async function createConversation(
  userId: string,
  chatbot: ChatbotId,
): Promise<string | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('chat_conversations')
    .insert({ user_id: userId, chatbot })
    .select('id')
    .single();
  if (error || !data) return null;
  return data.id as string;
}

export async function saveMessage(
  conversationId: string,
  userId: string,
  role: 'user' | 'assistant',
  content: string,
): Promise<void> {
  if (!content.trim()) return;
  const supabase = getSupabaseClient();
  await supabase
    .from('chat_messages')
    .insert({ conversation_id: conversationId, user_id: userId, role, content });
  await supabase
    .from('chat_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);
}

export async function loadMessages(conversationId: string): Promise<ChatHistoryMessage[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(500);
  if (error || !data) return [];
  return data as ChatHistoryMessage[];
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase.from('chat_conversations').delete().eq('id', conversationId);
}

/**
 * Génère puis enregistre le titre + la catégorie de la conversation (IA, /api/chat-meta).
 * Échec silencieux : une métadonnée manquante ne doit jamais casser le chat.
 */
export async function generateConversationMeta(
  conversationId: string,
  accessToken: string,
  userText: string,
  assistantText: string,
): Promise<{ title: string; category: string } | null> {
  try {
    const res = await fetch('/api/chat-meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ userText, assistantText }),
    });
    if (!res.ok) return null;
    const meta = (await res.json()) as { title?: string; category?: string };
    if (!meta?.title) return null;
    const supabase = getSupabaseClient();
    await supabase
      .from('chat_conversations')
      .update({ title: meta.title, category: meta.category ?? 'Autre' })
      .eq('id', conversationId);
    return { title: meta.title, category: meta.category ?? 'Autre' };
  } catch {
    return null;
  }
}
