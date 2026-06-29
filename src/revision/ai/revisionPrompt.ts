/**
 * Contexte serveur pur du coup de pouce IA des révisions (feature `revision_plan_assist`,
 * ADR-0027 phase 2) — testé dans tests/unit/revision-ai.test.ts.
 *
 * Sécurité : les métriques injectées dans le prompt sont RECALCULÉES par le moteur
 * déterministe à partir du plan fourni (jamais des chiffres « annoncés » par le client),
 * et l'instruction est bornée à une intention d'ORGANISATION. Aucune donnée de santé.
 */
import { sanitizeStoredPlan, storedPlanToInput, completedByResource, type StoredPlan } from '@/revision/db/plans';
import { redistribute } from '@/revision/engine/redistribution';
import { daysBetween } from '@/revision/engine/dates';
import type { RiskLevel } from '@/revision/types';

export type BoostIntent = 'optimize' | 'rebalance' | 'realistic' | 'reminders';

const INTENTS: BoostIntent[] = ['optimize', 'rebalance', 'realistic', 'reminders'];

export interface BoostRequest {
  intent: BoostIntent;
  stored: StoredPlan;
}

/** Borne et valide le corps de la requête (intention + plan). */
export function coerceBoostRequest(body: unknown): BoostRequest {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const intent = INTENTS.includes(b.intent as BoostIntent) ? (b.intent as BoostIntent) : 'optimize';
  return { intent, stored: sanitizeStoredPlan(b.plan) };
}

const RISK_LABEL: Record<RiskLevel, string> = {
  green: 'dans les temps',
  orange: 'tendu',
  red: 'irréaliste / en surcharge',
};

function fmtMinutes(min: number): string {
  const r = Math.round(min);
  if (r < 60) return `${r} min`;
  const h = Math.floor(r / 60);
  const m = r % 60;
  return m === 0 ? `${h} h` : `${h} h ${m}`;
}

/** Bloc de contexte (chiffres vérifiés) à concaténer au prompt système. */
export function buildRevisionContext(stored: StoredPlan, today: string): string {
  const input = storedPlanToInput(stored);
  const result = redistribute(input, {
    completedMinutesByResource: completedByResource(stored),
    today,
  });
  const daysLeft = daysBetween(today, stored.examDate);
  const dailyAvg = Number.isFinite(result.dailyAverageMinutes)
    ? fmtMinutes(result.dailyAverageMinutes)
    : 'indéfini (aucun jour disponible)';

  const blocks = stored.resources.length
    ? stored.resources
        .map(
          (r) =>
            `- ${r.title || 'Bloc sans titre'} (priorité ${r.priority}) : ` +
            `${r.pages} pages, ${r.chapters} chapitres, ${r.qcm} QCM` +
            (r.completedMinutes > 0 ? ` — déjà ${fmtMinutes(r.completedMinutes)} faits` : ''),
        )
        .join('\n')
    : '- (aucun bloc de travail saisi)';

  return `\n\n--- ÉTAT DU PLAN (chiffres vérifiés par le moteur — n'en invente aucun autre) ---
Examen dans ${daysLeft} jour(s) ; ${result.usableDaysCount} jour(s) réellement disponibles.
Charge restante : ${fmtMinutes(result.remainingWorkloadMinutes)} ; charge moyenne nécessaire : ${dailyAvg}/jour ; capacité fixée : ${fmtMinutes(stored.dailyMaxMinutes)}/jour.
Progression : ${Math.round(result.progressPercent)} %.
Statut calculé : ${RISK_LABEL[result.risk.level]} — ${result.risk.reason}
Blocs de travail :
${blocks}
--- FIN DE L'ÉTAT ---`;
}

const INSTRUCTIONS: Record<BoostIntent, string> = {
  optimize: 'Optimise mon planning de révision : rends-le plus réaliste et soutenable.',
  rebalance: 'Rééquilibre la charge restante en tenant compte de mon avancement actuel.',
  realistic: 'Mon planning est-il réaliste ? Dis-le-moi franchement et propose des coupes ou priorités si besoin.',
  reminders: 'Propose des sessions de rappel espacées (J+1, J+7, J+21) cohérentes avec mes blocs.',
};

/** Message utilisateur correspondant à l'intention choisie. */
export function intentInstruction(intent: BoostIntent): string {
  return INSTRUCTIONS[intent];
}
