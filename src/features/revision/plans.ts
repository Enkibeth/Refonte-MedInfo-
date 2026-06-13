/**
 * Validation/normalisation des plans de révision enregistrés (table `revision_plans`
 * + `revision_plan_items`, ADR-0027). Module PUR et testable.
 *
 * Borne et nettoie le payload venu du client AVANT écriture en base (own-row RLS).
 * Aucune donnée de santé : volumes de travail et dates pédagogiques uniquement.
 */
import { isIsoDate } from './engine/dates';
import type { ExamType } from './engine/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const MAX_TITLE_CHARS = 160;
export const MAX_SUBJECT_CHARS = 120;
export const MAX_ITEMS = 200;
const EXAM_TYPES: ExamType[] = ['pass_las', 'dfgsm', 'edn', 'ecos', 'custom'];

export interface PlanItemPayload {
  title: string;
  subject: string | null;
  pages: number;
  chapters: number;
  qcm: number;
  priority: number;
  completedPages: number;
  completedChapters: number;
  completedQcm: number;
  mastery: number;
  position: number;
}

export interface PlanPayload {
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
  items: PlanItemPayload[];
}

export type SanitizeResult = { ok: true; value: PlanPayload } | { ok: false; error: string };

export function coercePlanId(value: unknown): string | null {
  return typeof value === 'string' && UUID_RE.test(value) ? value : null;
}

function text(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function int(value: unknown, lo: number, hi: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

function num(value: unknown, lo: number, hi: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}

function coerceExamType(value: unknown): ExamType {
  return EXAM_TYPES.includes(value as ExamType) ? (value as ExamType) : 'custom';
}

function coerceRestWeekdays(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const set = new Set<number>();
  for (const v of value) {
    const n = Number(v);
    if (Number.isInteger(n) && n >= 0 && n <= 6) set.add(n);
  }
  return [...set].sort((a, b) => a - b);
}

function coerceUnavailableDays(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const set = new Set<string>();
  for (const v of value) if (isIsoDate(v)) set.add(v);
  return [...set].sort().slice(0, 366);
}

function coerceItem(raw: unknown, position: number): PlanItemPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const title = text(r.title, MAX_TITLE_CHARS);
  if (!title) return null; // un bloc sans titre n'est pas exploitable
  const subject = text(r.subject, MAX_SUBJECT_CHARS);
  return {
    title,
    subject: subject || null,
    pages: int(r.pages, 0, 100_000, 0),
    chapters: int(r.chapters, 0, 10_000, 0),
    qcm: int(r.qcm, 0, 1_000_000, 0),
    priority: int(r.priority, 1, 3, 2),
    completedPages: int(r.completedPages, 0, 100_000, 0),
    completedChapters: int(r.completedChapters, 0, 10_000, 0),
    completedQcm: int(r.completedQcm, 0, 1_000_000, 0),
    mastery: int(r.mastery, 0, 5, 0),
    position: int(r.position ?? position, 0, 100_000, position),
  };
}

/**
 * Valide et borne un plan complet (métadonnées + blocs). Échoue si les dates sont
 * absentes/invalides ou si l'examen ne suit pas le début. Renvoie un objet propre.
 */
export function sanitizePlanPayload(body: unknown): SanitizeResult {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;

  if (!isIsoDate(b.startDate)) return { ok: false, error: 'startDate invalide (yyyy-mm-dd).' };
  if (!isIsoDate(b.examDate)) return { ok: false, error: 'examDate invalide (yyyy-mm-dd).' };
  if (b.examDate <= b.startDate) {
    return { ok: false, error: "La date d'examen doit suivre la date de début." };
  }

  const itemsRaw = Array.isArray(b.items) ? b.items.slice(0, MAX_ITEMS) : [];
  const items = itemsRaw
    .map((raw, i) => coerceItem(raw, i))
    .filter((it): it is PlanItemPayload => it !== null)
    // Position compactée sur l'ordre final (les blocs sans titre ont été retirés).
    .map((it, i) => ({ ...it, position: i }));

  return {
    ok: true,
    value: {
      title: text(b.title, MAX_TITLE_CHARS) || 'Plan de révision',
      examType: coerceExamType(b.examType),
      startDate: b.startDate as string,
      examDate: b.examDate as string,
      dailyMaxMinutes: int(b.dailyMaxMinutes, 15, 1440, 180),
      pagesPerHour: num(b.pagesPerHour, 0.1, 1000, 8),
      chaptersPerHour: num(b.chaptersPerHour, 0.1, 1000, 1.5),
      qcmPerHour: num(b.qcmPerHour, 1, 100_000, 60),
      bufferRatio: num(b.bufferRatio, 0, 0.5, 0.1),
      spacedRepetition: b.spacedRepetition === true,
      restWeekdays: coerceRestWeekdays(b.restWeekdays),
      unavailableDays: coerceUnavailableDays(b.unavailableDays),
      items,
    },
  };
}
