/**
 * GET /api/admin/costs?days=30 — Usage de tokens par chatbot (panel admin).
 *
 * Agrège la table `ai_interactions` (service role — RLS sans policy) sur une fenêtre
 * temporelle, groupé par persona × modèle. Le CLIENT applique la grille de prix
 * (src/admin/cost.ts) pour estimer le coût : les tokens sont réels, le coût est indicatif.
 *
 * Accès restreint aux comptes admin (requireAdmin). Aucun contenu de message n'est lu
 * (seulement persona, modèle et compteurs de tokens).
 */
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/admin/index';
import { groupConversationUsage, groupUsage } from '@/admin/cost';

function serviceClient() {
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return createClient(url, key, { auth: { persistSession: false } });
}

const ALLOWED_DAYS = [7, 30, 90];

export async function GET(request: Request): Promise<Response> {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const daysParam = Number(url.searchParams.get('days'));
  const days = ALLOWED_DAYS.includes(daysParam) ? daysParam : 30;

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const db = serviceClient();
  const { data, error } = await db
    .from('ai_interactions')
    .select('persona, model_used, tokens_in, tokens_out, conversation_id, created_at')
    .gte('created_at', since)
    .limit(100000);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Groupage côté serveur (le prix est appliqué côté client, une seule grille) :
  //  - `usage` : par feature/chatbot × modèle (global) ;
  //  - `conversations` : par conversation × modèle (lignes portant un conversation_id).
  const rows = data ?? [];
  return Response.json({
    days,
    usage: groupUsage(rows),
    conversations: groupConversationUsage(rows),
  });
}
