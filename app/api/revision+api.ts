/**
 * CRUD des plans de révision (tables `revision_plans` + `revision_plan_items`, ADR-0027).
 *
 * Appelé par l'écran étudiant avec le Bearer token de session. Client Supabase SCOPÉ
 * AU TOKEN → la RLS own-row (migration 0027) est la barrière réelle : un utilisateur ne
 * lit/écrit/supprime QUE ses plans. Jamais le service_role ici.
 *
 *   GET    /api/revision            → liste (id, title, exam_type, exam_date, updated_at)
 *   GET    /api/revision?id=<uuid>  → un plan complet (métadonnées + blocs)
 *   POST   /api/revision            → upsert { id?, ...plan, items[] } (remplace les blocs)
 *   DELETE /api/revision?id=<uuid>  → supprime le plan (et ses blocs en cascade)
 *
 * Pas d'appel LLM (ce n'est pas une feature IA) : le moteur de planification est pur et
 * tourne côté client (src/features/revision/engine). L'« AI Boost » est différé (ADR-0027).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { getBearerToken } from '@/auth/serverIdentity';
import { coercePlanId, sanitizePlanPayload, type PlanItemPayload } from '@/features/revision/plans';

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

function itemRow(item: PlanItemPayload, planId: string, userId: string) {
  return {
    plan_id: planId,
    user_id: userId,
    title: item.title,
    subject: item.subject,
    pages: item.pages,
    chapters: item.chapters,
    qcm: item.qcm,
    priority: item.priority,
    completed_pages: item.completedPages,
    completed_chapters: item.completedChapters,
    completed_qcm: item.completedQcm,
    mastery: item.mastery,
    position: item.position,
  };
}

export async function GET(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if ('response' in auth) return auth.response;

  const id = coercePlanId(new URL(request.url).searchParams.get('id'));

  if (id) {
    const { data: plan, error } = await auth.client
      .from('revision_plans')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) return Response.json({ error: 'Lecture impossible.' }, { status: 502 });
    if (!plan) return Response.json({ error: 'Introuvable.' }, { status: 404 });

    const { data: items, error: itemsError } = await auth.client
      .from('revision_plan_items')
      .select('*')
      .eq('plan_id', id)
      .order('position', { ascending: true });
    if (itemsError) return Response.json({ error: 'Lecture impossible.' }, { status: 502 });

    return Response.json({ plan, items: items ?? [] });
  }

  const { data, error } = await auth.client
    .from('revision_plans')
    .select('id, title, exam_type, exam_date, status, updated_at')
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

  const sanitized = sanitizePlanPayload(body);
  if (!sanitized.ok) return Response.json({ error: sanitized.error }, { status: 400 });
  const v = sanitized.value;
  const now = new Date().toISOString();

  const planFields = {
    title: v.title,
    exam_type: v.examType,
    start_date: v.startDate,
    exam_date: v.examDate,
    daily_max_minutes: v.dailyMaxMinutes,
    pages_per_hour: v.pagesPerHour,
    chapters_per_hour: v.chaptersPerHour,
    qcm_per_hour: v.qcmPerHour,
    buffer_ratio: v.bufferRatio,
    spaced_repetition: v.spacedRepetition,
    rest_weekdays: v.restWeekdays,
    unavailable_days: v.unavailableDays,
    updated_at: now,
  };

  const requestedId = coercePlanId((body as { id?: unknown }).id);
  let planId: string | null = null;

  if (requestedId) {
    const { data, error } = await auth.client
      .from('revision_plans')
      .update(planFields)
      .eq('id', requestedId)
      .select('id')
      .maybeSingle();
    if (error) return Response.json({ error: 'Enregistrement impossible.' }, { status: 502 });
    if (data) planId = data.id; // sinon id obsolète → on recrée ci-dessous
  }

  if (!planId) {
    const { data, error } = await auth.client
      .from('revision_plans')
      .insert({ user_id: auth.userId, ...planFields })
      .select('id')
      .maybeSingle();
    if (error || !data) return Response.json({ error: 'Enregistrement impossible.' }, { status: 502 });
    planId = data.id;
  }

  // Remplace l'ensemble des blocs (le client tient l'état complet et le renvoie à chaque save).
  const { error: delError } = await auth.client
    .from('revision_plan_items')
    .delete()
    .eq('plan_id', planId);
  if (delError) return Response.json({ error: 'Enregistrement impossible.' }, { status: 502 });

  if (v.items.length > 0) {
    const rows = v.items.map((it) => itemRow(it, planId as string, auth.userId));
    const { error: insError } = await auth.client.from('revision_plan_items').insert(rows);
    if (insError) return Response.json({ error: 'Enregistrement impossible.' }, { status: 502 });
  }

  return Response.json({ id: planId, updatedAt: now });
}

export async function DELETE(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if ('response' in auth) return auth.response;

  const id = coercePlanId(new URL(request.url).searchParams.get('id'));
  if (!id) return Response.json({ error: 'id requis.' }, { status: 400 });

  const { error } = await auth.client.from('revision_plans').delete().eq('id', id);
  if (error) return Response.json({ error: 'Suppression impossible.' }, { status: 502 });
  return Response.json({ ok: true });
}
