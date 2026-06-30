/**
 * CRUD de l'historique cloud des CV (table `cv_documents`, ADR-0028).
 *
 * Appelé par la page autonome (iframe `public/cv-builder.html`) avec le Bearer token de
 * session. On crée un client Supabase SCOPÉ AU TOKEN : la RLS own-row (migration 0029) est
 * la barrière réelle — un utilisateur ne lit/écrit/supprime QUE ses CV.
 *
 *   GET    /api/cv-docs            → liste (id, title, updated_at)
 *   GET    /api/cv-docs?id=<uuid>  → un CV complet (document)
 *   POST   /api/cv-docs            → upsert { id?, title, theme, document }
 *   DELETE /api/cv-docs?id=<uuid>  → supprime
 *
 * Pas d'appel LLM ici (ce n'est pas une feature IA) : la relecture vit dans /api/cv.
 * Un CV contient des données personnelles → RLS own-row stricte, jamais le service_role.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { getBearerToken } from '@/auth/serverIdentity';
import { coerceCvId, sanitizeCvPayload } from '@/cv/cvDocument';

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

  const id = coerceCvId(new URL(request.url).searchParams.get('id'));

  if (id) {
    const { data, error } = await auth.client
      .from('cv_documents')
      .select('id, title, theme, document, created_at, updated_at')
      .eq('id', id)
      .maybeSingle();
    if (error) return Response.json({ error: 'Lecture impossible.' }, { status: 502 });
    if (!data) return Response.json({ error: 'Introuvable.' }, { status: 404 });
    return Response.json({ cv: data });
  }

  const { data, error } = await auth.client
    .from('cv_documents')
    .select('id, title, updated_at')
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

  const sanitized = sanitizeCvPayload(body);
  if (!sanitized.ok) return Response.json({ error: sanitized.error }, { status: 400 });
  const { title, theme, document } = sanitized.value;

  const id = coerceCvId((body as { id?: unknown }).id);
  const now = new Date().toISOString();

  // Mise à jour si un id valide est fourni ET que la ligne appartient au user (RLS).
  if (id) {
    const { data, error } = await auth.client
      .from('cv_documents')
      .update({ title, theme, document, updated_at: now })
      .eq('id', id)
      .select('id, updated_at')
      .maybeSingle();
    if (error) return Response.json({ error: 'Enregistrement impossible.' }, { status: 502 });
    if (data) return Response.json({ id: data.id, updatedAt: data.updated_at });
    // id obsolète (ligne supprimée ailleurs) → on recrée une entrée fraîche ci-dessous.
  }

  const { data, error } = await auth.client
    .from('cv_documents')
    .insert({ user_id: auth.userId, title, theme, document })
    .select('id, updated_at')
    .maybeSingle();
  if (error || !data) return Response.json({ error: 'Enregistrement impossible.' }, { status: 502 });
  return Response.json({ id: data.id, updatedAt: data.updated_at });
}

export async function DELETE(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if ('response' in auth) return auth.response;

  const id = coerceCvId(new URL(request.url).searchParams.get('id'));
  if (!id) return Response.json({ error: 'id requis.' }, { status: 400 });

  const { error } = await auth.client.from('cv_documents').delete().eq('id', id);
  if (error) return Response.json({ error: 'Suppression impossible.' }, { status: 502 });
  return Response.json({ ok: true });
}
