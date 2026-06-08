/**
 * Réglages de génération du chat pilotés par l'utilisateur (curseurs). Module PUR, sans
 * dépendance : partagé entre l'UI (ChatSettingsSheet) et le serveur (responseDirectives),
 * pour une source unique du contrat. ADR-0021.
 *
 * - Réflexion : profondeur du raisonnement (rapide → maximal).
 * - Détail    : longueur/richesse de la réponse (simple → complet).
 * - Rapidité  : DÉRIVÉE automatiquement de la réflexion (moins de réflexion = plus rapide),
 *               affichée à titre indicatif, non réglable directement.
 */
export type ReasoningLevel = 'rapide' | 'standard' | 'approfondi' | 'maximal';
export type DetailLevel = 'simple' | 'standard' | 'complet';

export interface GenerationSettings {
  reasoning: ReasoningLevel;
  detail: DetailLevel;
}

export const DEFAULT_GENERATION: GenerationSettings = { reasoning: 'standard', detail: 'standard' };

export const REASONING_OPTIONS: { value: ReasoningLevel; label: string }[] = [
  { value: 'rapide', label: 'Rapide' },
  { value: 'standard', label: 'Standard' },
  { value: 'approfondi', label: 'Approfondi' },
  { value: 'maximal', label: 'Maximal' },
];

export const DETAIL_OPTIONS: { value: DetailLevel; label: string }[] = [
  { value: 'simple', label: 'Simple' },
  { value: 'standard', label: 'Standard' },
  { value: 'complet', label: 'Complet' },
];

/** Rapidité dérivée (inverse de la réflexion) — pour l'indicateur automatique. */
export const SPEED_BY_REASONING: Record<ReasoningLevel, string> = {
  rapide: 'Très rapide',
  standard: 'Rapide',
  approfondi: 'Posé',
  maximal: 'Lent',
};
