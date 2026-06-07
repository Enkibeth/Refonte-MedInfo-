/**
 * Persistance locale, privacy-first — inspirée de QCM-quizz (« tes decks restent
 * dans ton navigateur »). Stockage WEB UNIQUEMENT via window.localStorage :
 * aucune donnée n'est envoyée à un serveur MedInfo par ce module.
 *
 * Volontairement tolérant : en natif (pas de localStorage), en navigation privée
 * ou si le quota échoue, les lectures renvoient le fallback et les écritures sont
 * des no-op. Ne JAMAIS y stocker de secret. Les données éventuellement sensibles
 * (comptes rendus) restent locales à l'appareil et effaçables par l'utilisateur.
 */
import { Platform } from 'react-native';

function store(): Storage | null {
  if (Platform.OS !== 'web') return null;
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Lecture JSON tolérante : renvoie `fallback` si absent, illisible ou indisponible. */
export function readJSON<T>(key: string, fallback: T): T {
  const s = store();
  if (!s) return fallback;
  try {
    const raw = s.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Écriture JSON tolérante (no-op hors web ou si le quota est dépassé). */
export function writeJSON(key: string, value: unknown): void {
  const s = store();
  if (!s) return;
  try {
    s.setItem(key, JSON.stringify(value));
  } catch {
    /* quota dépassé / mode privé : on ignore silencieusement */
  }
}

export function removeKey(key: string): void {
  const s = store();
  if (!s) return;
  try {
    s.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Vrai si une persistance locale est réellement disponible (web + storage OK). */
export function isLocalStoreAvailable(): boolean {
  return store() !== null;
}
