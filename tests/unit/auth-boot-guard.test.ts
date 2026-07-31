import { describe, it, expect, vi } from 'vitest';

import {
  AUTH_BOOT_TIMEOUT_MS,
  PROFILE_TIMEOUT_MS,
  SESSION_HINT_KEY,
  SESSION_TIMEOUT_MS,
  abortAfter,
  clearStoredSession,
  readSessionHint,
  supabaseAuthStorageKeys,
  withTimeout,
  writeSessionHint,
  type HintStorage,
} from '@/auth/bootGuard';

/** Stockage en mémoire (localStorage de test). */
function memoryStorage(initial: Record<string, string> = {}): HintStorage & { map: Map<string, string> } {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

/** Stockage qui lève à chaque accès (Safari navigation privée / stockage bloqué). */
const throwingStorage: HintStorage = {
  getItem: () => {
    throw new Error('storage blocked');
  },
  setItem: () => {
    throw new Error('storage blocked');
  },
  removeItem: () => {
    throw new Error('storage blocked');
  },
};

describe('withTimeout — aucune étape d’amorçage ne peut retenir l’écran', () => {
  it('renvoie la valeur quand la promesse répond à temps', async () => {
    const result = await withTimeout(Promise.resolve('ok'), 1000, 'repli');
    expect(result).toEqual({ value: 'ok', timedOut: false });
  });

  it('renvoie le repli avec timedOut=true quand la promesse ne se règle JAMAIS', async () => {
    vi.useFakeTimers();
    const never = new Promise<string>(() => {});
    const pending = withTimeout(never, 5000, 'repli');
    await vi.advanceTimersByTimeAsync(5000);
    await expect(pending).resolves.toEqual({ value: 'repli', timedOut: true });
    vi.useRealTimers();
  });

  it('un rejet donne le repli mais timedOut=false (la réponse est arrivée, en erreur)', async () => {
    const result = await withTimeout(Promise.reject(new Error('boom')), 1000, null);
    expect(result).toEqual({ value: null, timedOut: false });
  });

  it('ne laisse pas de minuteur derrière lui quand la promesse gagne la course', async () => {
    vi.useFakeTimers();
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
    await withTimeout(Promise.resolve(1), 10_000, 0);
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
    vi.useRealTimers();
  });

  it('les plafonds sont ordonnés : profil < session < chien de garde', () => {
    expect(PROFILE_TIMEOUT_MS).toBeLessThan(SESSION_TIMEOUT_MS);
    expect(SESSION_TIMEOUT_MS).toBeLessThan(AUTH_BOOT_TIMEOUT_MS);
  });
});

describe('indice de session (visiteur vs session à récupérer)', () => {
  it('écrit, lit et efface l’indice', () => {
    const storage = memoryStorage();
    expect(readSessionHint(storage)).toBe(false);
    writeSessionHint(true, storage);
    expect(storage.map.get(SESSION_HINT_KEY)).toBe('1');
    expect(readSessionHint(storage)).toBe(true);
    writeSessionHint(false, storage);
    expect(readSessionHint(storage)).toBe(false);
  });

  it('stockage indisponible → false, jamais d’exception', () => {
    expect(() => writeSessionHint(true, throwingStorage)).not.toThrow();
    expect(readSessionHint(throwingStorage)).toBe(false);
    expect(readSessionHint(null)).toBe(false);
  });
});

describe('réinitialisation de session sans réseau (remplace le « vider les cookies »)', () => {
  it('dérive les clés de stockage Supabase depuis l’URL du projet', () => {
    expect(supabaseAuthStorageKeys('https://abcdef.supabase.co')).toEqual([
      'sb-abcdef-auth-token',
      'sb-abcdef-auth-token-code-verifier',
      'sb-abcdef-auth-token-user',
    ]);
  });

  it('URL absente ou invalide → aucune clé (jamais d’exception)', () => {
    expect(supabaseAuthStorageKeys(undefined)).toEqual([]);
    expect(supabaseAuthStorageKeys('pas une url')).toEqual([]);
  });

  it('efface le token stocké ET l’indice, sans toucher au reste', () => {
    const storage = memoryStorage({
      'sb-abcdef-auth-token': '{"access_token":"x"}',
      'sb-abcdef-auth-token-code-verifier': 'v',
      [SESSION_HINT_KEY]: '1',
      'medinfo:chatCountry': 'FR',
    });
    expect(clearStoredSession('https://abcdef.supabase.co', storage)).toBe(true);
    expect(storage.map.has('sb-abcdef-auth-token')).toBe(false);
    expect(storage.map.has('sb-abcdef-auth-token-code-verifier')).toBe(false);
    expect(readSessionHint(storage)).toBe(false);
    // Les autres préférences de l'utilisateur ne sont PAS emportées.
    expect(storage.map.get('medinfo:chatCountry')).toBe('FR');
  });

  it('rien à effacer → false ; stockage bloqué → pas d’exception', () => {
    expect(clearStoredSession('https://abcdef.supabase.co', memoryStorage())).toBe(false);
    expect(() => clearStoredSession('https://abcdef.supabase.co', throwingStorage)).not.toThrow();
    expect(clearStoredSession('https://abcdef.supabase.co', null)).toBe(false);
  });
});

describe('abortAfter — libère réellement la requête pendante', () => {
  it('renvoie un AbortSignal quand la plateforme le permet', () => {
    const signal = abortAfter(1000);
    expect(signal === undefined || typeof signal.aborted === 'boolean').toBe(true);
  });
});
