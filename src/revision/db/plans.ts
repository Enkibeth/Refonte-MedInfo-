/**
 * Sérialisation / validation des plans de révision enregistrés (table `revision_plans`,
 * ADR-0027) — module PUR et testable (tests/unit/revision-plans.test.ts).
 *
 * Le plan est conservé en JSONB (`StoredPlan`) : c'est un document pédagogique autonome
 * (dates, capacité, rythme, blocs de travail + avancement), jamais une donnée de santé.
 * Ce module borne le contenu AVANT écriture (own-row RLS) et convertit vers/depuis l'entrée
 * du moteur déterministe (`@/revision/engine`).
 */
import type {
  ExamType,
  PlanInput,
  RevisionResource,
  SpeedProfile,
} from '@/revision/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const EXAM_TYPES: ExamType[] = ['pass_las', 'dfgsm', 'edn', 'ecos', 'custom'];
export const MAX_TITLE_CHARS = 120;
export const MAX_RESOURCES = 100;
export const MAX_UNAVAILABLE_DAYS = 366;

/** Un bloc de travail tel que stocké (volumes + avancement en minutes). */
export interface StoredResource extends RevisionResource {
  /** Confiance d'étude initiale 0–5 (jamais un état de santé). */
  masteryStart: number;
  /** Minutes déjà accomplies sur ce bloc. */
  completedMinutes: number;
}

/** Plan complet sérialisé en base (JSONB). */
export interface StoredPlan {
  startDate: string;
  examDate: string;
  unavailableDays: string[];
  dailyMaxMinutes: number;
  bufferRatio: number;
  speed: SpeedProfile;
  resources: StoredResource[];
}

export const DEFAULT_SPEED: SpeedProfile = {
  pagesPerHour: 10,
  chaptersPerHour: 2,
  qcmPerHour: 60,
};

/** Id de plan transmis par le client (uuid, sinon null). */
export function coercePlanId(value: unknown): string | null {
  return typeof value === 'string' && UUID_RE.test(value) ? value : null;
}

export function coerceExamType(value: unknown): ExamType {
  return EXAM_TYPES.includes(value as ExamType) ? (value as ExamType) : 'custom';
}

export function coerceTitle(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE_CHARS);
}

function num(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function isISODate(value: unknown): value is string {
  return typeof value === 'string' && ISO_DATE_RE.test(value) && !Number.isNaN(Date.parse(value));
}

function coerceSpeed(value: unknown): SpeedProfile {
  const s = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  return {
    pagesPerHour: clamp(num(s.pagesPerHour, DEFAULT_SPEED.pagesPerHour), 0, 10_000),
    chaptersPerHour: clamp(num(s.chaptersPerHour, DEFAULT_SPEED.chaptersPerHour), 0, 10_000),
    qcmPerHour: clamp(num(s.qcmPerHour, DEFAULT_SPEED.qcmPerHour), 0, 100_000),
  };
}

/** Id de bloc : chaîne stable courte (pas nécessairement un uuid). */
function coerceResourceId(value: unknown, index: number): string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 64
    ? value.trim()
    : `r${index}`;
}

/** Génère un id de bloc unique côté client (sans dépendance crypto). */
export function newResourceId(): string {
  return `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function coerceResource(value: unknown, index: number): StoredResource {
  const r = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  return {
    id: coerceResourceId(r.id, index),
    title: coerceTitle(r.title) || `Bloc ${index + 1}`,
    pages: clamp(Math.round(num(r.pages, 0)), 0, 1_000_000),
    chapters: clamp(Math.round(num(r.chapters, 0)), 0, 100_000),
    qcm: clamp(Math.round(num(r.qcm, 0)), 0, 1_000_000),
    priority: clamp(Math.round(num(r.priority, 1)), 1, 99),
    masteryStart: clamp(Math.round(num(r.masteryStart, 0)), 0, 5),
    completedMinutes: clamp(num(r.completedMinutes, 0), 0, 100_000_000),
  };
}

/** Valide et borne un plan brut (body client ou ligne DB) en `StoredPlan` propre. */
export function sanitizeStoredPlan(value: unknown): StoredPlan {
  const p = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;

  const startDate = isISODate(p.startDate) ? p.startDate : todayISO();
  const examDate = isISODate(p.examDate) ? p.examDate : startDate;

  const unavailableDays = Array.isArray(p.unavailableDays)
    ? p.unavailableDays.filter(isISODate).slice(0, MAX_UNAVAILABLE_DAYS)
    : [];

  const resources = Array.isArray(p.resources)
    ? p.resources.slice(0, MAX_RESOURCES).map(coerceResource)
    : [];

  return {
    startDate,
    examDate,
    unavailableDays,
    dailyMaxMinutes: clamp(Math.round(num(p.dailyMaxMinutes, 120)), 5, 24 * 60),
    bufferRatio: clamp(num(p.bufferRatio, 0.1), 0, 1),
    speed: coerceSpeed(p.speed),
    resources,
  };
}

/** Entrée du moteur déterministe à partir d'un plan stocké (volumes restants = totaux). */
export function storedPlanToInput(stored: StoredPlan): PlanInput {
  return {
    startDate: stored.startDate,
    examDate: stored.examDate,
    unavailableDays: stored.unavailableDays,
    dailyMaxMinutes: stored.dailyMaxMinutes,
    bufferRatio: stored.bufferRatio,
    speed: stored.speed,
    resources: stored.resources.map<RevisionResource>((r) => ({
      id: r.id,
      title: r.title,
      pages: r.pages,
      chapters: r.chapters,
      qcm: r.qcm,
      priority: r.priority,
    })),
  };
}

/** Minutes accomplies par bloc, pour `redistribute()`. */
export function completedByResource(stored: StoredPlan): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of stored.resources) out[r.id] = r.completedMinutes;
  return out;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
