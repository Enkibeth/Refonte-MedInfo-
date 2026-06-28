/**
 * Score de risque d'un plan de révision — module PUR (jauge anti-panique).
 *
 * Trois niveaux, transparents et testables (tests/unit/revision-planner.test.ts) :
 *  - vert   : charge < 80 % de la capacité quotidienne ;
 *  - orange : charge 80–110 % (tendu, peu de marge) ;
 *  - rouge  : charge > 110 %, OU retard > 10 %, OU aucun jour disponible.
 *
 * Le moteur ne masque JAMAIS l'irréalisme d'un planning (ADR-0027).
 */
import type { RiskAssessment } from '@/revision/types';

/** Seuils (exposés pour les tests et l'UI). */
export const RISK_THRESHOLDS = {
  /** Au-delà : orange. */
  tense: 0.8,
  /** Au-delà : rouge. */
  overload: 1.1,
  /** Retard relatif au-delà duquel le plan passe rouge. */
  lateness: 0.1,
} as const;

export function assessRisk(params: {
  /** Charge restante (minutes, buffer inclus). */
  totalMinutes: number;
  /** Nombre de jours réellement disponibles. */
  usableDays: number;
  /** Capacité quotidienne (minutes). */
  dailyMaxMinutes: number;
  /** Retard relatif optionnel (0–1 ; 0.2 = 20 % de retard). */
  latenessRatio?: number;
}): RiskAssessment {
  const { totalMinutes, usableDays, dailyMaxMinutes, latenessRatio = 0 } = params;

  if (usableDays <= 0) {
    return {
      level: 'red',
      capacityRatio: Infinity,
      dailyAverageMinutes: Infinity,
      reason: 'Aucun jour disponible avant l’examen : le plan est irréalisable en l’état.',
    };
  }

  const dailyAverageMinutes = totalMinutes / usableDays;
  const capacityRatio = dailyMaxMinutes > 0 ? dailyAverageMinutes / dailyMaxMinutes : Infinity;

  if (capacityRatio > RISK_THRESHOLDS.overload || latenessRatio > RISK_THRESHOLDS.lateness) {
    const reason =
      latenessRatio > RISK_THRESHOLDS.lateness
        ? `Retard de ${Math.round(latenessRatio * 100)} % : il faut alléger ou prioriser.`
        : 'Charge supérieure à ta capacité quotidienne : réduis le volume ou repousse des tâches.';
    return { level: 'red', capacityRatio, dailyAverageMinutes, reason };
  }

  if (capacityRatio >= RISK_THRESHOLDS.tense) {
    return {
      level: 'orange',
      capacityRatio,
      dailyAverageMinutes,
      reason: 'Plan tendu mais réaliste : peu de marge, surveille les jours lourds.',
    };
  }

  return {
    level: 'green',
    capacityRatio,
    dailyAverageMinutes,
    reason: 'Plan réaliste : la charge tient confortablement dans tes journées.',
  };
}
