/**
 * CRUD client des plans de révision (table `revision_plans`, ADR-0027).
 *
 * Écran natif (pas d'iframe) → on utilise le client Supabase navigateur (clé anon) :
 * la RLS own-row (migration 0027) est la barrière réelle — l'utilisateur ne lit/écrit
 * QUE ses plans. Même pattern que `src/document/analysisHistory.ts`. Aucun appel LLM.
 */
import { getSupabaseClient } from '@/db/supabase';
import {
  coerceExamType,
  coerceTitle,
  sanitizeStoredPlan,
  type StoredPlan,
} from '@/revision/db/plans';
import type { ExamType } from '@/revision/types';

const LIST_LIMIT = 100;

/** Entrée de la liste « Mes plans ». */
export interface RevisionPlanListItem {
  id: string;
  title: string;
  exam_type: ExamType;
  exam_date: string;
  updated_at: string;
}

/** Plan complet rechargé depuis la base. */
export interface RevisionPlanRecord extends RevisionPlanListItem {
  plan: StoredPlan;
  created_at: string;
}

export async function listPlans(): Promise<RevisionPlanListItem[]> {
  const { data, error } = await getSupabaseClient()
    .from('revision_plans')
    .select('id, title, exam_type, exam_date, updated_at')
    .order('updated_at', { ascending: false })
    .limit(LIST_LIMIT);
  if (error) throw new Error(error.message);
  return (data ?? []) as RevisionPlanListItem[];
}

export async function getPlan(id: string): Promise<RevisionPlanRecord | null> {
  const { data, error } = await getSupabaseClient()
    .from('revision_plans')
    .select('id, title, exam_type, exam_date, plan, created_at, updated_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { ...(data as RevisionPlanRecord), plan: sanitizeStoredPlan(data.plan) };
}

export interface SavePlanInput {
  id?: string | null;
  userId: string;
  title: string;
  examType: ExamType;
  plan: StoredPlan;
}

/**
 * Upsert d'un plan. Avec `id` → update (RLS garantit la propriété) ; sinon insert.
 * `exam_type` / `exam_date` sont dérivés du plan pour l'affichage de la liste.
 */
export async function savePlan(input: SavePlanInput): Promise<{ id: string; updatedAt: string }> {
  const supabase = getSupabaseClient();
  const plan = sanitizeStoredPlan(input.plan);
  const row = {
    title: coerceTitle(input.title) || 'Mon plan de révision',
    exam_type: coerceExamType(input.examType),
    exam_date: plan.examDate,
    plan,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await supabase
      .from('revision_plans')
      .update(row)
      .eq('id', input.id)
      .select('id, updated_at')
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return { id: data.id as string, updatedAt: data.updated_at as string };
    // id obsolète (supprimé ailleurs) → on recrée ci-dessous.
  }

  const { data, error } = await supabase
    .from('revision_plans')
    .insert({ ...row, user_id: input.userId })
    .select('id, updated_at')
    .maybeSingle();
  if (error || !data) throw new Error(error?.message ?? 'Enregistrement impossible.');
  return { id: data.id as string, updatedAt: data.updated_at as string };
}

export async function deletePlan(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from('revision_plans').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
