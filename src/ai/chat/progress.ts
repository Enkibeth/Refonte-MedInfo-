/**
 * Progression du chat — latence PERÇUE.
 *
 * Compteur d'attente et sélection du message assistant en cours. Le déroulé des étapes
 * lui-même vit dans src/ai/chat/researchTimeline.ts (2026-10).
 *
 * Module PUR (aucune dépendance UI/réseau) : testé dans tests/unit/chat-progress.test.ts.
 */

/**
 * Attente longue : au-delà de ce seuil, on rappelle à l'utilisateur qu'il peut quitter
 * l'app — la génération va au bout côté serveur et la réponse l'attend dans l'historique
 * (`keepAlive` côté route + reprise côté client). Sans ce message, une attente de 60 s+
 * ressemble à un plantage et l'utilisateur relance inutilement une génération.
 */
export const LONG_WAIT_MS = 25_000;

/** Compteur de secondes écoulées, borné et stable (jamais de décimale à l'écran). */
export function elapsedLabel(ms: number): string {
  if (!Number.isFinite(ms) || ms < 1000) return '';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds} s`;
  const min = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${min} min` : `${min} min ${rest} s`;
}

/**
 * Message assistant RÉELLEMENT en cours de génération : le dernier message du fil, et
 * seulement s'il est de l'assistant.
 *
 * Sans ce filtre, la bulle de statut du tour N affiche la trace du tour N−1 (retour Hugo
 * 2026-07) : entre l'envoi d'une question et l'arrivée du premier fragment de réponse, le
 * dernier message assistant du fil est encore le PRÉCÉDENT, avec ses compteurs d'outils —
 * l'utilisateur voyait « Vérification des liens (2) » de la réponse d'avant, puis tout
 * basculait d'un coup sur la réponse en cours. Tant que la nouvelle réponse n'a pas
 * commencé, il n'y a AUCUNE étape à montrer.
 */
export function inFlightAssistant<T extends { role?: unknown }>(
  messages: readonly T[] | null | undefined,
): T | null {
  if (!Array.isArray(messages) || messages.length === 0) return null;
  const last = messages[messages.length - 1];
  return last && last.role === 'assistant' ? last : null;
}
