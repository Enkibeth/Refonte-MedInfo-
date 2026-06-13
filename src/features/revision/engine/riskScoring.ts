/**
 * Score de réalisme du plan — PUR et déterministe.
 *
 * Trois niveaux « anti-panique » :
 *   - vert   : plan confortable (charge < 80 % de la capacité, tampon présent) ;
 *   - orange : plan tendu (charge 80–110 %, marge faible) ;
 *   - rouge  : plan irréaliste (charge > 110 %, débordement, ou plus de jours).
 *
 * L'IA n'a PAS le droit de produire ces valeurs en texte libre : elles viennent d'ici.
 */
import type { RiskAssessment } from './types';

export interface RiskInput {
  dailyAverageMinutes: number;
  dailyMaxMinutes: number;
  bufferDays: number;
  schedulingDays: number;
  overflowMinutes: number;
}

/** Seuil minimal de jours tampon en dessous duquel on alerte (orange). */
export const MIN_BUFFER_DAYS = 2;

export function assessRisk(input: RiskInput): RiskAssessment {
  const { dailyAverageMinutes, dailyMaxMinutes, bufferDays, schedulingDays, overflowMinutes } =
    input;

  const cap = dailyMaxMinutes > 0 ? dailyMaxMinutes : 1;
  const loadRatio = dailyAverageMinutes / cap;

  // Rien à planifier (aucun volume restant) : pas d'alerte.
  if (dailyAverageMinutes <= 0 && overflowMinutes <= 0) {
    return { level: 'green', loadRatio: 0, reason: 'Rien à planifier : tout est à jour.' };
  }
  if (schedulingDays <= 0) {
    return {
      level: 'red',
      loadRatio,
      reason: "Plus aucun jour planifiable avant l'examen : il faut réduire ou prioriser.",
    };
  }
  if (overflowMinutes > 0 || loadRatio > 1.1) {
    return {
      level: 'red',
      loadRatio,
      reason:
        overflowMinutes > 0
          ? "Le volume ne tient pas avant l'examen : allège ou hiérarchise les blocs secondaires."
          : 'Charge quotidienne supérieure à ta capacité : plan irréaliste en l’état.',
    };
  }
  if (loadRatio >= 0.8) {
    return {
      level: 'orange',
      loadRatio,
      reason: 'Plan tendu mais réaliste : peu de marge en cas d’imprévu.',
    };
  }
  // Charge significative mais sans tampon : on signale le manque de marge (orange).
  if (loadRatio >= 0.5 && bufferDays < MIN_BUFFER_DAYS) {
    return {
      level: 'orange',
      loadRatio,
      reason: `Plan correct mais sans marge : seulement ${bufferDays} jour(s) tampon.`,
    };
  }
  return {
    level: 'green',
    loadRatio,
    reason: 'Plan réaliste : tu as de la marge pour absorber un retard.',
  };
}
