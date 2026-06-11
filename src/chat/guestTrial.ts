/**
 * Essai sans inscription (décision Hugo, 2026-06) : un visiteur non connecté peut
 * envoyer UN message gratuit dans le chat (indicateur 1/1 → 0/1), puis l'UI propose
 * inscription / connexion.
 *
 * Le marqueur vit côté client (localStorage sur web, mémoire sinon) : c'est une
 * couche d'ERGONOMIE. Côté serveur, /api/chat refuse toute conversation anonyme
 * dépassant un message utilisateur (défense en profondeur).
 */
const STORAGE_KEY = 'medinfo.guest_message_used';

/** Repli quand localStorage est indisponible (natif, navigation privée stricte). */
let memoryUsed = false;

export function isGuestMessageUsed(): boolean {
  try {
    if (globalThis.localStorage?.getItem(STORAGE_KEY) === '1') return true;
  } catch {
    /* localStorage indisponible → repli mémoire */
  }
  return memoryUsed;
}

export function markGuestMessageUsed(): void {
  memoryUsed = true;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, '1');
  } catch {
    /* repli mémoire déjà posé */
  }
}

/** Réinitialisation pour les tests. */
export function __resetGuestTrialForTests(): void {
  memoryUsed = false;
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    /* no-op */
  }
}
