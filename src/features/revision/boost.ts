/**
 * AI Boost du planificateur (ADR-0027) — cœur PUR et testable.
 *
 * L'IA ne fait que PROPOSER des ajustements ; elle ne modifie jamais le plan elle-même
 * (l'utilisateur valide chaque suggestion). Surtout, elle ne peut choisir QUE dans un
 * vocabulaire d'actions BORNÉ et ne référencer QUE des blocs existants : elle n'invente
 * jamais de volume (pages/chapitres/QCM), de bloc, de source, ni de conseil médical.
 *
 * Ce module : construit le contexte (chiffres déterministes du moteur), parse/valide
 * la réponse JSON du modèle (fail-closed : tout ce qui sort du cadre est ignoré), et
 * applique une suggestion de façon DÉTERMINISTE au plan.
 */
import type { PlannerResult } from './engine/types';
import { formatMinutes } from './engine/planner';
import type { FullPlan } from './api';

export const BOOST_ACTION_TYPES = [
  'set_buffer_ratio',
  'enable_spaced_repetition',
  'set_rest_weekends',
  'increase_daily_max',
  'set_block_priority',
] as const;

export type BoostActionType = (typeof BOOST_ACTION_TYPES)[number];

export interface BoostSuggestionBase {
  /** Libellé court de l'action (affiché sur le bouton/carte). */
  label: string;
  /** Justification pédagogique courte (jamais un conseil médical). */
  rationale: string;
}

export type BoostSuggestion = BoostSuggestionBase &
  (
    | { type: 'set_buffer_ratio'; value: number }
    | { type: 'enable_spaced_repetition' }
    | { type: 'set_rest_weekends'; value: boolean }
    | { type: 'increase_daily_max'; minutes: number }
    | { type: 'set_block_priority'; blockId: string; priority: number }
  );

export interface BoostResponse {
  /** Lecture en clair de la situation (pédagogique, non médicale). */
  assessment: string;
  suggestions: BoostSuggestion[];
  /** true si le modèle a refusé (sortie du cadre pédagogique). */
  refused: boolean;
}

const MAX_TEXT = 400;
const MAX_SUGGESTIONS = 6;

function clampText(value: unknown, max = MAX_TEXT): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function clampNum(value: unknown, lo: number, hi: number): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Construit la section de contexte (chiffres déterministes + blocs valides) à
 * concaténer au prompt système `revision_boost`. Le modèle ne doit JAMAIS recalculer
 * ces chiffres ni inventer d'autres blocs que ceux listés (référencés par `id`).
 */
export function buildBoostContext(plan: FullPlan, result: PlannerResult): string {
  const lines: string[] = ['', '# DONNÉES DU PLAN (déterministes — ne RIEN recalculer, ne RIEN inventer)'];
  lines.push(`- Examen dans ${result.daysUntilExam} jour(s).`);
  lines.push(`- Statut : ${result.risk.level} — ${result.risk.reason}`);
  lines.push(`- Jours planifiables : ${result.schedulingDays} ; jours tampon : ${result.bufferDays}.`);
  lines.push(`- Charge quotidienne moyenne requise : ${formatMinutes(result.dailyAverageMinutes)} ; plafond déclaré : ${formatMinutes(plan.dailyMaxMinutes)} (ratio ${Math.round(result.risk.loadRatio * 100)}%).`);
  lines.push(`- Temps total restant : ${formatMinutes(result.totalRemainingMinutes)} ; débordement (ne tient pas avant l'examen) : ${formatMinutes(result.overflowMinutes)}.`);
  lines.push(`- Tampon actuel : ${Math.round(plan.bufferRatio * 100)}% ; révision espacée : ${plan.spacedRepetition ? 'activée' : 'désactivée'} ; week-ends de repos : ${plan.restWeekdays.includes(0) && plan.restWeekdays.includes(6) ? 'oui' : 'non'}.`);
  lines.push('');
  lines.push('# BLOCS (référence un bloc UNIQUEMENT par son id ci-dessous, jamais d\'autre)');
  if (plan.items.length === 0) {
    lines.push('- (aucun bloc)');
  } else {
    for (const it of plan.items) {
      const total = it.pages + it.chapters + it.qcm;
      const done = it.completedPages + it.completedChapters + it.completedQcm;
      const pct = total > 0 ? Math.round((done / total) * 100) : 100;
      lines.push(`- id="${it.id}" · « ${it.title} »${it.subject ? ` (${it.subject})` : ''} · priorité ${it.priority} · ${pct}% fait`);
    }
  }
  return lines.join('\n');
}

/** Extrait le premier objet JSON d'un texte (bloc ```json ... ``` ou première accolade). */
function extractJson(text: string): unknown {
  if (typeof text !== 'string') return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function coerceSuggestion(raw: unknown, validBlockIds: Set<string>, currentDailyMax: number): BoostSuggestion | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const type = r.type;
  if (typeof type !== 'string' || !(BOOST_ACTION_TYPES as readonly string[]).includes(type)) return null;

  const label = clampText(r.label, 80);
  const rationale = clampText(r.rationale, MAX_TEXT);
  if (!label || !rationale) return null;
  const base = { label, rationale };

  switch (type as BoostActionType) {
    case 'set_buffer_ratio': {
      const value = clampNum(r.value, 0, 0.5);
      return value == null ? null : { ...base, type: 'set_buffer_ratio', value: Math.round(value * 100) / 100 };
    }
    case 'enable_spaced_repetition':
      return { ...base, type: 'enable_spaced_repetition' };
    case 'set_rest_weekends':
      return { ...base, type: 'set_rest_weekends', value: r.value === true };
    case 'increase_daily_max': {
      const minutes = clampNum(r.minutes, 15, 1440);
      // Doit réellement AUGMENTER le plafond, sinon la suggestion n'a pas de sens.
      if (minutes == null || Math.round(minutes) <= currentDailyMax) return null;
      return { ...base, type: 'increase_daily_max', minutes: Math.round(minutes) };
    }
    case 'set_block_priority': {
      const blockId = typeof r.blockId === 'string' ? r.blockId : '';
      const priority = clampNum(r.priority, 1, 3);
      if (!validBlockIds.has(blockId) || priority == null) return null;
      return { ...base, type: 'set_block_priority', blockId, priority: Math.round(priority) };
    }
    default:
      return null;
  }
}

/**
 * Parse et VALIDE la réponse du modèle. Fail-closed : toute suggestion hors vocabulaire,
 * hors bornes, ou référençant un bloc inexistant est ignorée. Si le JSON est illisible,
 * renvoie une réponse vide (pas d'exception).
 */
export function parseBoostResponse(text: string, plan: FullPlan): BoostResponse {
  const json = extractJson(text) as Record<string, unknown> | null;
  if (!json) return { assessment: '', suggestions: [], refused: false };

  const refused = json.refused === true;
  const assessment = clampText(json.assessment, MAX_TEXT);
  const validIds = new Set(plan.items.map((it) => it.id));
  const rawList = Array.isArray(json.suggestions) ? json.suggestions.slice(0, MAX_SUGGESTIONS) : [];
  const suggestions = refused
    ? []
    : rawList
        .map((s) => coerceSuggestion(s, validIds, plan.dailyMaxMinutes))
        .filter((s): s is BoostSuggestion => s !== null);

  return { assessment, suggestions, refused };
}

/** Applique une suggestion au plan de façon DÉTERMINISTE (l'utilisateur l'a validée). */
export function applyBoostSuggestion(plan: FullPlan, s: BoostSuggestion): FullPlan {
  switch (s.type) {
    case 'set_buffer_ratio':
      return { ...plan, bufferRatio: Math.min(0.5, Math.max(0, s.value)) };
    case 'enable_spaced_repetition':
      return { ...plan, spacedRepetition: true };
    case 'set_rest_weekends':
      return { ...plan, restWeekdays: s.value ? [0, 6] : [] };
    case 'increase_daily_max':
      return { ...plan, dailyMaxMinutes: Math.min(1440, Math.max(15, s.minutes)) };
    case 'set_block_priority':
      return {
        ...plan,
        items: plan.items.map((it) =>
          it.id === s.blockId ? { ...it, priority: Math.min(3, Math.max(1, s.priority)) } : it,
        ),
      };
    default:
      return plan;
  }
}
