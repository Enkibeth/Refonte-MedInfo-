import { useSyncExternalStore } from 'react';

/**
 * Mode plein écran du chat (demande Hugo 2026-09) : seul le fil et la saisie restent,
 * texte à la taille de l'app Messages d'Apple (17 px). Un petit magasin partagé, car
 * l'écran de chat et le shell desktop (AppShell) doivent
 * réagir. La préférence est mémorisée localement (`medinfo:chatFocus`) ; elle n'est
 * relue qu'après le montage du chat (jamais au pré-rendu : pas d'erreur d'hydratation).
 */
const STORAGE_KEY = 'medinfo:chatFocus';

let focused = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function setChatFocus(next: boolean, persist = true): void {
  if (focused === next) return;
  focused = next;
  if (persist) {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, next ? '1' : '0');
    } catch {
      // Stockage indisponible (navigation privée…) : le mode reste valable pour la session.
    }
  }
  emit();
}

export function readChatFocusPref(): boolean {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const snapshot = () => focused;
const serverSnapshot = () => false;

export function useChatFocus(): boolean {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

/** Taille « Messages » d'iOS : corps 17 pt ; interligne un peu plus aéré pour la lecture longue. */
export const FOCUS_TEXT_SIZE = { fontSize: 17, lineHeight: 26 } as const;
