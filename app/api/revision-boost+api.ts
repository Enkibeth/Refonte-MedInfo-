/**
 * POST /api/revision-boost — AI Boost du planificateur de révisions (ADR-0027, suivi).
 *
 * Le « coach d'organisation » lit les CHIFFRES DÉTERMINISTES du plan (recalculés côté
 * serveur par le moteur, jamais pris dans le body) et PROPOSE des ajustements bornés
 * (tampon, révision espacée, repos, plafond, priorité d'un bloc existant). Il ne modifie
 * RIEN : l'étudiant valide chaque suggestion côté client. Réponse strictement validée
 * (fail-closed) par `parseBoostResponse` : toute action hors vocabulaire est ignorée.
 *
 * Sécurité : outil réservé aux étudiants vérifiés (et admins). Persona dérivée du profil
 * (own-row RLS), jamais du body. Le plan est lu sous RLS (client scopé au token).
 *
 * ⚠️  CONVENTION : le modèle utilisé (feature key: "revision_boost") est configurable
 * depuis le panel admin (app/(admin)/index.tsx). Toute étape IA ici doit être déclarée
 * dans src/admin/index.ts AI_FEATURES.
 */
import { generateText } from 'ai';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { isAdminUserId } from '@/admin/index';
import { getBearerToken } from '@/auth/serverIdentity';
import { getRuntimeForFeature } from '@/ai/providers/featureRuntime';
import { getPromptTemplate } from '@/ai/prompts/promptStore';
import { checkChatRateLimit } from '@/ai/rateLimit/chatRateLimit';
import { buildPlan } from '@/features/revision/engine/planner';
import { buildBoostContext, parseBoostResponse } from '@/features/revision/boost';
import { coercePlanId } from '@/features/revision/plans';
import type { FullPlan } from '@/features/revision/api';
import type { RevisionItem } from '@/features/revision/engine/types';

type Authed = { client: SupabaseClient; userId: string };

async function authenticate(request: Request): Promise<Authed | { response: Response }> {
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { response: Response.json({ error: 'Backend non configuré.' }, { status: 503 }) };
  const token = getBearerToken(request);
  if (!token) return { response: Response.json({ error: 'Non authentifié.' }, { status: 401 }) };
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return { response: Response.json({ error: 'Session invalide.' }, { status: 401 }) };
  return { client, userId: data.user.id };
}

function num(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function mapItem(r: Record<string, unknown>): RevisionItem {
  return {
    id: String(r.id ?? ''),
    title: String(r.title ?? ''),
    subject: (r.subject as string | null) ?? undefined,
    pages: num(r.pages, 0),
    chapters: num(r.chapters, 0),
    qcm: num(r.qcm, 0),
    priority: num(r.priority, 2),
    completedPages: num(r.completed_pages, 0),
    completedChapters: num(r.completed_chapters, 0),
    completedQcm: num(r.completed_qcm, 0),
  };
}

export async function POST(request: Request): Promise<Response> {
  // Quota technique (compteur étudiant) — aucune donnée de plan stockée par le rate-limit.
  const rateLimit = await checkChatRateLimit(request, 'student');
  if (!rateLimit.allowed) {
    return Response.json({ error: 'Limite de suggestions atteinte pour aujourd’hui.' }, { status: 429 });
  }

  const auth = await authenticate(request);
  if ('response' in auth) return auth.response;

  // Persona EFFECTIVE dérivée du profil vérifié (own-row RLS), jamais du body.
  const { data: profile } = await auth.client.from('profiles').select('persona').eq('id', auth.userId).maybeSingle();
  const persona = (profile?.persona as string | undefined) ?? 'public';
  const allowed = isAdminUserId(auth.userId) || persona === 'student';
  if (!allowed) {
    return Response.json({ error: 'Outil réservé aux comptes étudiant vérifiés.' }, { status: 403 });
  }

  let body: { id?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'JSON invalide.' }, { status: 400 });
  }
  const planId = coercePlanId(body.id);
  if (!planId) return Response.json({ error: 'id de plan requis.' }, { status: 400 });

  // Lecture du plan sous RLS (le user ne lit que SON plan). Les chiffres viennent d'ici,
  // jamais du body : impossible de fausser le contexte du modèle.
  const { data: planRow, error: planErr } = await auth.client
    .from('revision_plans')
    .select('*')
    .eq('id', planId)
    .maybeSingle();
  if (planErr) return Response.json({ error: 'Lecture impossible.' }, { status: 502 });
  if (!planRow) return Response.json({ error: 'Plan introuvable.' }, { status: 404 });

  const { data: itemRows, error: itemErr } = await auth.client
    .from('revision_plan_items')
    .select('*')
    .eq('plan_id', planId)
    .order('position', { ascending: true });
  if (itemErr) return Response.json({ error: 'Lecture impossible.' }, { status: 502 });

  const plan: FullPlan = {
    id: String(planRow.id),
    title: (planRow.title as string | null) ?? '',
    examType: (planRow.exam_type as FullPlan['examType']) ?? 'custom',
    startDate: String(planRow.start_date),
    examDate: String(planRow.exam_date),
    dailyMaxMinutes: num(planRow.daily_max_minutes, 180),
    pagesPerHour: num(planRow.pages_per_hour, 8),
    chaptersPerHour: num(planRow.chapters_per_hour, 1.5),
    qcmPerHour: num(planRow.qcm_per_hour, 60),
    bufferRatio: num(planRow.buffer_ratio, 0.1),
    spacedRepetition: planRow.spaced_repetition === true,
    restWeekdays: Array.isArray(planRow.rest_weekdays) ? (planRow.rest_weekdays as number[]) : [],
    unavailableDays: Array.isArray(planRow.unavailable_days) ? (planRow.unavailable_days as string[]) : [],
    items: (itemRows ?? []).map((r) => mapItem(r as Record<string, unknown>)),
  };

  const today = new Date().toISOString().slice(0, 10);
  const result = buildPlan({
    today,
    window: {
      startDate: plan.startDate,
      examDate: plan.examDate,
      unavailableDays: plan.unavailableDays,
      restWeekdays: plan.restWeekdays,
      dailyMaxMinutes: plan.dailyMaxMinutes,
    },
    speed: { pagesPerHour: plan.pagesPerHour, chaptersPerHour: plan.chaptersPerHour, qcmPerHour: plan.qcmPerHour },
    items: plan.items,
    bufferRatio: plan.bufferRatio,
    spacedRepetition: plan.spacedRepetition,
  });

  const [template, runtime] = await Promise.all([
    getPromptTemplate('revision_boost'),
    getRuntimeForFeature('revision_boost'),
  ]);
  const system = `${template}${buildBoostContext(plan, result)}`;

  try {
    const { text } = await generateText({
      model: runtime.model,
      system,
      messages: [{ role: 'user', content: 'Analyse mon plan et propose des ajustements d’organisation.' }],
      ...runtime.options,
    });
    const parsed = parseBoostResponse(text, plan);
    return Response.json(parsed);
  } catch (e) {
    console.error('Revision boost error:', e);
    return Response.json({ error: 'Échec de la génération des suggestions.' }, { status: 502 });
  }
}
