/**
 * CRUD de l'historique cloud des présentations (table `presentation_decks`, ADR-0026).
 *
 * Appelé par la page autonome (iframe `public/presentation.html`) avec le Bearer token
 * de session. On crée un client Supabase SCOPÉ AU TOKEN : la RLS own-row (migration 0026)
 * est la barrière réelle — un utilisateur ne lit/écrit/supprime QUE ses présentations.
 *
 *   GET    /api/presentations           → liste (id, title, theme, updated_at)
 *   GET    /api/presentations?id=<uuid> → une présentation complète (deck + ai_history)
 *   POST   /api/presentations           → upsert { id?, title, theme, deck, aiHistory }
 *   DELETE /api/presentations?id=<uuid> → supprime
 *
 * Pas d'appel LLM ici (ce n'est pas une feature IA) : la génération vit dans /api/presentation.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { getBearerToken } from '@/auth/serverIdentity';
import { coerceDeckId, sanitizeDeckPayload } from '@/presentation/decks';

const LIST_LIMIT = 100;

type Authed = { client: SupabaseClient; userId: string };

async function authenticate(request: Request): Promise<Authed | { response: Response }> {
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return { response: Response.json({ error: 'Backend non configuré.' }, { status: 503 }) };
  }
  const token = getBearerToken(request);
  if (!token) {
    return { response: Response.json({ error: 'Non authentifié.' }, { status: 401 }) };
  }
  // Client scopé au token → RLS appliquée (own-row). Jamais le service_role ici.
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    return { response: Response.json({ error: 'Session invalide.' }, { status: 401 }) };
  }
  return { client, userId: data.user.id };
}

export async function GET(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if ('response' in auth) return auth.response;

  const id = coerceDeckId(new URL(request.url).searchParams.get('id'));

  if (id) {
    const { data, error } = await auth.client
      .from('presentation_decks')
      .select('id, title, theme, deck, ai_history, created_at, updated_at')
      .eq('id', id)
      .maybeSingle();
    if (error) return Response.json({ error: 'Lecture impossible.' }, { status: 502 });
    if (!data) return Response.json({ error: 'Introuvable.' }, { status: 404 });
    return Response.json({ deck: data });
  }

  const { data, error } = await auth.client
    .from('presentation_decks')
    .select('id, title, theme, updated_at')
    .order('updated_at', { ascending: false })
    .limit(LIST_LIMIT);
  if (error) return Response.json({ error: 'Lecture impossible.' }, { status: 502 });
  return Response.json({ items: data ?? [] });
}

export async function POST(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if ('response' in auth) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'JSON invalide.' }, { status: 400 });
  }

  const sanitized = sanitizeDeckPayload(body);
  if (!sanitized.ok) return Response.json({ error: sanitized.error }, { status: 400 });
  const { title, theme, deck, aiHistory } = sanitized.value;

  const id = coerceDeckId((body as { id?: unknown }).id);
  const now = new Date().toISOString();

  // Mise à jour si un id valide est fourni ET que la ligne appartient au user (RLS).
  if (id) {
    const { data, error } = await auth.client
      .from('presentation_decks')
      .update({ title, theme, deck, ai_history: aiHistory, updated_at: now })
      .eq('id', id)
      .select('id, updated_at')
      .maybeSingle();
    if (error) return Response.json({ error: 'Enregistrement impossible.' }, { status: 502 });
    if (data) return Response.json({ id: data.id, updatedAt: data.updated_at });
    // id obsolète (ligne supprimée ailleurs) → on recrée une entrée fraîche ci-dessous.
  }

  const { data, error } = await auth.client
    .from('presentation_decks')
    .insert({ user_id: auth.userId, title, theme, deck, ai_history: aiHistory })
    .select('id, updated_at')
    .maybeSingle();
  if (error || !data) return Response.json({ error: 'Enregistrement impossible.' }, { status: 502 });
  return Response.json({ id: data.id, updatedAt: data.updated_at });
}

export async function DELETE(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if ('response' in auth) return auth.response;

  const id = coerceDeckId(new URL(request.url).searchParams.get('id'));
  if (!id) return Response.json({ error: 'id requis.' }, { status: 400 });

  const { error } = await auth.client.from('presentation_decks').delete().eq('id', id);
  if (error) return Response.json({ error: 'Suppression impossible.' }, { status: 502 });
  return Response.json({ ok: true });
}
