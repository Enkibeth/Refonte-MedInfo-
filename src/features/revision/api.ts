/**
 * Accès client à l'API des plans de révision (`/api/revision`, ADR-0027).
 *
 * Appels authentifiés (Bearer token de session). La RLS own-row (migration 0027) est la
 * barrière réelle côté serveur ; ce module ne fait que sérialiser/désérialiser et mapper
 * les lignes snake_case de Supabase vers les types camelCase du moteur. Aucune donnée de santé.
 */
import type { ExamType, RevisionItem } from './engine/types';

export interface PlanSummary {
  id: string;
  title: string | null;
  examType: ExamType;
  examDate: string;
  status: 'active' | 'archived';
  updatedAt: string;
}

export interface FullPlan {
  id: string;
  title: string;
  examType: ExamType;
  startDate: string;
  examDate: string;
  dailyMaxMinutes: number;
  pagesPerHour: number;
  chaptersPerHour: number;
  qcmPerHour: number;
  bufferRatio: number;
  spacedRepetition: boolean;
  restWeekdays: number[];
  unavailableDays: string[];
  items: RevisionItem[];
}

/** Corps envoyé au POST (id optionnel = upsert). */
export type PlanDraft = Omit<FullPlan, 'id'> & { id?: string };

function num(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function mapItem(row: Record<string, unknown>): RevisionItem {
  return {
    id: String(row.id ?? ''),
    title: String(row.title ?? ''),
    subject: (row.subject as string | null) ?? undefined,
    pages: num(row.pages, 0),
    chapters: num(row.chapters, 0),
    qcm: num(row.qcm, 0),
    priority: num(row.priority, 2),
    completedPages: num(row.completed_pages, 0),
    completedChapters: num(row.completed_chapters, 0),
    completedQcm: num(row.completed_qcm, 0),
  };
}

function authHeaders(token: string): HeadersInit {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export async function listPlans(token: string): Promise<PlanSummary[]> {
  const res = await fetch('/api/revision', { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Chargement des plans impossible.');
  const data = await res.json();
  return (data.items ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    title: (r.title as string | null) ?? null,
    examType: (r.exam_type as ExamType) ?? 'custom',
    examDate: String(r.exam_date ?? ''),
    status: (r.status as 'active' | 'archived') ?? 'active',
    updatedAt: String(r.updated_at ?? ''),
  }));
}

export async function getPlan(token: string, id: string): Promise<FullPlan | null> {
  const res = await fetch(`/api/revision?id=${encodeURIComponent(id)}`, {
    headers: authHeaders(token),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Chargement du plan impossible.');
  const data = await res.json();
  const p = data.plan as Record<string, unknown>;
  return {
    id: String(p.id),
    title: (p.title as string | null) ?? '',
    examType: (p.exam_type as ExamType) ?? 'custom',
    startDate: String(p.start_date ?? ''),
    examDate: String(p.exam_date ?? ''),
    dailyMaxMinutes: num(p.daily_max_minutes, 180),
    pagesPerHour: num(p.pages_per_hour, 8),
    chaptersPerHour: num(p.chapters_per_hour, 1.5),
    qcmPerHour: num(p.qcm_per_hour, 60),
    bufferRatio: num(p.buffer_ratio, 0.1),
    spacedRepetition: p.spaced_repetition === true,
    restWeekdays: Array.isArray(p.rest_weekdays) ? (p.rest_weekdays as number[]) : [],
    unavailableDays: Array.isArray(p.unavailable_days) ? (p.unavailable_days as string[]) : [],
    items: (data.items ?? []).map((r: Record<string, unknown>) => mapItem(r)),
  };
}

/** Upsert. Renvoie l'id du plan (créé ou mis à jour). */
export async function savePlan(token: string, draft: PlanDraft): Promise<string> {
  const res = await fetch('/api/revision', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(draft),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error ?? 'Enregistrement impossible.');
  }
  const data = await res.json();
  return String(data.id);
}

export async function deletePlan(token: string, id: string): Promise<void> {
  const res = await fetch(`/api/revision?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Suppression impossible.');
}
