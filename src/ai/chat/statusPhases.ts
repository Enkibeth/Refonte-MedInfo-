/**
 * Phases de génération d'une réponse du chat — modèle de l'indicateur circulaire (2026-08).
 *
 * Depuis le retour à la base (ADR-0037), le chat ne fait qu'UN appel LLM : la timeline
 * « Étapes » n'a plus rien à raconter. Il reste malgré tout trois moments distincts que
 * l'utilisateur perçoit, et qu'il est utile de nommer pendant l'attente :
 *
 *   raisonnement  →  recherche sur Internet  →  rédaction
 *
 * Ce module est le MODÈLE de l'anneau de progression (rendu dans ChatStatusRing) : à quelle
 * fraction du tour il est rendu, quel libellé, quelle icône. Il est PUR — aucune dépendance
 * UI, aucun réseau — et testé dans tests/unit/chat-status-phases.test.ts.
 *
 * `recovering` n'est pas une étape de génération mais un état de reprise (la réponse est
 * allée au bout côté serveur, on va la chercher) : il vit hors de la progression et ne
 * fait donc jamais reculer l'anneau.
 */

import type { IconName } from '@/ui/iconPaths';

export type ChatPhase = 'thinking' | 'searching' | 'writing' | 'recovering';

/** Les trois étapes réelles de la génération, dans l'ordre où elles surviennent. */
export const CHAT_PHASE_ORDER: ChatPhase[] = ['thinking', 'searching', 'writing'];

export interface ChatPhaseView {
  /** Libellé affiché à côté de l'anneau. */
  label: string;
  /** Icône au centre de l'anneau (nom du design system — jamais une chaîne libre). */
  icon: IconName;
  /**
   * Fraction de l'anneau remplie, dans [0, 1]. Volontairement < 1 sur la dernière étape :
   * l'anneau ne se referme jamais pendant l'attente — un cercle complet dirait « terminé »
   * alors que la réponse est encore en train de s'écrire.
   */
  progress: number;
  /** Rang de l'étape (0-2) parmi CHAT_PHASE_ORDER ; -1 pour un état hors progression. */
  step: number;
}

const VIEWS: Record<ChatPhase, ChatPhaseView> = {
  thinking: { label: 'Raisonnement…', icon: 'brain', progress: 0.18, step: 0 },
  searching: { label: 'Recherche sur Internet…', icon: 'search', progress: 0.58, step: 1 },
  writing: { label: 'Rédaction de la réponse…', icon: 'sparkles', progress: 0.9, step: 2 },
  // Reprise après une coupure : la génération est finie côté serveur, on récupère.
  recovering: { label: 'Récupération de la réponse…', icon: 'clock', progress: 0.5, step: -1 },
};

/** Vue (libellé, icône, progression) d'une phase. Repli sur `thinking` si inconnue. */
export function chatPhaseView(phase: ChatPhase): ChatPhaseView {
  return VIEWS[phase] ?? VIEWS.thinking;
}

/**
 * Libellé de la phase, en laissant la main à un libellé d'outil plus précis quand le flux
 * en fournit un (« Recherche : « … » »). Seule la phase de recherche accepte ce détail :
 * ailleurs, un nom d'outil n'aurait rien à dire à l'utilisateur.
 */
export function chatPhaseLabel(phase: ChatPhase, toolLabel?: string | null): string {
  const detail = (toolLabel ?? '').trim();
  if (phase === 'searching' && detail) return detail;
  return chatPhaseView(phase).label;
}

/**
 * Une étape est-elle déjà FRANCHIE au regard de la phase courante ? (pastilles sous
 * l'anneau). L'étape en cours n'est pas « franchie » : elle est en cours.
 */
export function isPhaseDone(step: ChatPhase, current: ChatPhase): boolean {
  const a = CHAT_PHASE_ORDER.indexOf(step);
  const b = chatPhaseView(current).step;
  return a >= 0 && b >= 0 && a < b;
}

/**
 * Progression MONOTONE : l'anneau ne recule jamais.
 *
 * Le flux peut réordonner les signaux (un appel d'outil annoncé après les premiers
 * fragments de texte, une phase recalculée à un re-rendu). Sans cette garde, l'anneau
 * reculerait à l'écran — une barre qui recule est lue comme un bug, pas comme une nuance.
 */
export function monotonicProgress(previous: number, phase: ChatPhase): number {
  const next = chatPhaseView(phase).progress;
  return next > previous ? next : previous;
}
