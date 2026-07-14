/**
 * Vue d'ensemble (dashboard) — helpers PURS et testables (refonte shell 2026-07).
 *
 * Tout chiffre affiché par le dashboard vient d'ici : soit d'une donnée saisie /
 * enregistrée par l'utilisateur (conversations, passages ECOS, plans de révision),
 * soit du moteur déterministe de révision (`@/revision/engine`). Rien n'est inventé,
 * aucune donnée de santé n'est produite ni interprétée.
 */
import type { AppFeatureId } from '@/ai/routing/featureVisibility';
import {
  completedByResource,
  storedPlanToInput,
  type StoredPlan,
} from '@/revision/db/plans';
import { daysBetween } from '@/revision/engine/dates';
import { redistribute } from '@/revision/engine/redistribution';
import type { RiskLevel } from '@/revision/types';

// ── Salutation & repères temporels ───────────────────────────────────────────

/** Salutation selon l'heure locale (18 h → 5 h : « Bonsoir »). */
export function greetingWord(hour: number): 'Bonjour' | 'Bonsoir' {
  return hour >= 18 || hour < 5 ? 'Bonsoir' : 'Bonjour';
}

/** Numéro de semaine ISO 8601 (calcul en UTC — indépendant du fuseau du poste). */
export function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Jeudi de la semaine courante (ISO : la semaine appartient à l'année de son jeudi).
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
}

const WEEKDAYS_SHORT = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
const MONTHS_SHORT = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
];

/**
 * Libellé compact d'un horodatage pour la liste d'activité :
 * aujourd’hui → « 18:20 », hier → « Hier », < 7 jours → « Lun. », sinon « 12 juil. ».
 */
export function relativeLabel(iso: string, now: Date): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
  if (dayDiff <= 0) {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
  if (dayDiff === 1) return 'Hier';
  if (dayDiff < 7) return WEEKDAYS_SHORT[date.getDay()];
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
}

/** ISO `YYYY-MM-DD` → « 4 nov. 2026 » (libellé court FR, ex. date d'examen). */
export function shortDateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || m > 12 || !d) return iso;
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}

/** « 130 » minutes → « 2 h 10 » ; « 45 » → « 45 min » ; « 120 » → « 2 h ». */
export function formatMinutes(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  if (safe < 60) return `${safe} min`;
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return m > 0 ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

// ── Phrase du hero (« Qu’est-ce qui compte aujourd’hui ? ») ──────────────────

/** Jonction française : « a », « a et b », « a, b et c ». */
export function joinSentence(parts: string[]): string {
  const kept = parts.filter(Boolean);
  if (kept.length <= 1) return kept[0] ?? '';
  return `${kept.slice(0, -1).join(', ')} et ${kept[kept.length - 1]}`;
}

export function truncateLabel(value: string, max = 60): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

export interface HeroFacts {
  /** Charge planifiée aujourd’hui (minutes, moteur de révision) — null si sans plan. */
  todayMinutes: number | null;
  /** Dernier passage ECOS enregistré. */
  lastEcosTitle: string | null;
  /** Dernière conversation archivée. */
  lastConversationTitle: string | null;
}

/**
 * Sous-titre factuel du hero. Chaque segment n'apparaît que si la donnée existe ;
 * sans aucune donnée, invitation neutre (jamais de chiffre inventé).
 */
export function heroSummary(facts: HeroFacts): string {
  const parts: string[] = [];
  if (facts.todayMinutes != null && facts.todayMinutes > 0) {
    parts.push(`${formatMinutes(facts.todayMinutes)} de révision planifiées aujourd’hui`);
  }
  if (facts.lastEcosTitle) {
    parts.push(`un ECOS « ${truncateLabel(facts.lastEcosTitle, 48)} » à retravailler`);
  }
  if (facts.lastConversationTitle) {
    parts.push(`une conversation « ${truncateLabel(facts.lastConversationTitle, 48)} » à poursuivre`);
  }
  if (parts.length === 0) {
    return 'Pose une question au chat médical ou ouvre un outil — tout est prêt.';
  }
  return `Tu as ${joinSentence(parts)}.`;
}

// ── Prochain objectif (plan de révision réel) ────────────────────────────────

export const RISK_LABEL: Record<RiskLevel, string> = {
  green: 'Faible',
  orange: 'Modéré',
  red: 'Élevé',
};

export interface PlanSnapshot {
  /** Charge planifiée aujourd’hui (minutes), 0 si journée libre. */
  todayMinutes: number;
  riskLevel: RiskLevel;
  /** Avancement 0–100 (moteur : minutes accomplies ÷ charge totale). */
  progressPercent: number;
  /** Jours calendaires restants avant l'examen (0 si passé). */
  daysLeft: number;
  examDate: string;
}

/**
 * Photographie d'un plan de révision au jour donné, entièrement dérivée du
 * moteur déterministe (`redistribute`) — aucun chiffre produit ici même.
 */
export function planSnapshot(stored: StoredPlan, todayIso: string): PlanSnapshot {
  const result = redistribute(storedPlanToInput(stored), {
    completedMinutesByResource: completedByResource(stored),
    today: todayIso,
  });
  const today = result.dailyLoads.find((d) => d.date === todayIso);
  return {
    todayMinutes: Math.round(today?.minutes ?? 0),
    riskLevel: result.risk.level,
    progressPercent: result.progressPercent,
    daysLeft: daysBetween(todayIso, stored.examDate),
    examDate: stored.examDate,
  };
}

// ── Activité récente (fusion multi-outils) ───────────────────────────────────

export interface ActivityEntry {
  key: string;
  feature: AppFeatureId;
  title: string;
  detail: string | null;
  /** ISO — sert au tri décroissant. */
  timestamp: string;
  route: string;
}

export interface RecentActivityInput {
  conversations?: Array<{
    id: string;
    title: string | null;
    category: string | null;
    updated_at: string;
  }>;
  ecosAttempts?: Array<{
    id: string;
    case_title: string;
    score: number | null;
    created_at: string;
  }>;
  revisionPlans?: Array<{ id: string; title: string; updated_at: string }>;
}

/** Fusionne l'activité des outils en un fil trié (plus récent d'abord). */
export function buildRecentActivity(input: RecentActivityInput, limit = 6): ActivityEntry[] {
  const entries: ActivityEntry[] = [];
  for (const c of input.conversations ?? []) {
    entries.push({
      key: `chat-${c.id}`,
      feature: 'chat',
      title: truncateLabel(c.title || 'Conversation'),
      detail: c.category,
      timestamp: c.updated_at,
      // Deep-link : rouvre CETTE conversation (paramètre lu par app/(chat)/chat.tsx).
      route: `/(chat)/chat?conversation=${encodeURIComponent(c.id)}`,
    });
  }
  for (const a of input.ecosAttempts ?? []) {
    entries.push({
      key: `ecos-${a.id}`,
      feature: 'ecos',
      title: truncateLabel(`ECOS — ${a.case_title}`),
      detail: a.score != null ? `${a.score}/20` : 'Évaluation enregistrée',
      timestamp: a.created_at,
      route: '/(chat)/ecos',
    });
  }
  for (const p of input.revisionPlans ?? []) {
    entries.push({
      key: `revision-${p.id}`,
      feature: 'revision',
      title: truncateLabel(`Planning — ${p.title}`),
      detail: 'Plan mis à jour',
      timestamp: p.updated_at,
      route: '/(chat)/revision',
    });
  }
  return entries
    .filter((e) => !Number.isNaN(new Date(e.timestamp).getTime()))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}
