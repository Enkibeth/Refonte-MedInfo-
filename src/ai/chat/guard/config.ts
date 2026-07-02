/**
 * Mode de la garde du chat (ADR-0029) — tri-état via env MEDINFO_GUARDRAILS :
 *  - 'enforce' (défaut, sûr par défaut) : la garde bloque réellement.
 *  - 'log'     : mode observation — verdicts journalisés dans ai_interactions
 *                (guardrail_layer/intent_category) SANS bloquer. Prévu pour la
 *                première semaine de déploiement (mesure du taux de refus réel).
 *  - 'off'     : kill-switch d'incident (comportement chat direct ADR-0024).
 */
export type GuardMode = 'off' | 'log' | 'enforce';

export function guardMode(): GuardMode {
  const raw = (process.env.MEDINFO_GUARDRAILS ?? '').trim().toLowerCase();
  if (raw === 'off') return 'off';
  if (raw === 'log') return 'log';
  return 'enforce';
}
