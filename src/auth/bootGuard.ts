/**
 * Garde d'amorçage de l'authentification (incident « chargement infini », 2026-07-28).
 *
 * Symptôme rapporté : le site ne se charge qu'après avoir vidé les cookies / données de
 * site — sinon spinner sans fin. Cause : l'amorçage attendait Supabase SANS AUCUN plafond
 * de temps, et l'écran est gardé par `loading` (RoleGate, squelette du shell) :
 *
 *  1. `auth.getSession()` déclenche, quand un token est stocké, un rafraîchissement réseau
 *     (`_recoverAndRefresh` → `_callRefreshToken`) que auth-js REJOUE en backoff
 *     exponentiel ; aucun `AbortSignal` n'est posé sur ces requêtes, donc une connexion
 *     qui pend (réseau mobile, portail captif, onglet restauré par Safari) ne rend jamais
 *     la main → la promesse ne se règle JAMAIS → `loading` reste `true` à l'infini.
 *  2. Le chargement du profil (`profiles`) n'avait pas de délai non plus, et il était
 *     `await`é DANS le callback `onAuthStateChange` — que auth-js attend pendant son
 *     initialisation : notre requête réseau bloquait donc l'init de l'auth elle-même
 *     (Supabase déconseille explicitement d'appeler ses API dans ce callback).
 *
 * Sans token stocké (après vidage des cookies) aucune de ces deux requêtes n'a lieu :
 * l'app démarre instantanément — d'où le contournement manuel trouvé par l'utilisateur.
 *
 * Ce module fournit les briques PURES qui rendent le blocage structurellement impossible :
 * un plafond de temps sur chaque étape, et l'indice « ce navigateur a déjà eu une session »
 * qui permet de distinguer un visiteur d'une session en cours de récupération.
 *
 * Testé dans tests/unit/auth-boot-guard.test.ts.
 */

/**
 * Plafond DUR de l'amorçage : passé ce délai, l'application s'affiche quoi qu'il arrive
 * (mode dégradé). Généreux à dessein — un amorçage sain prend moins d'une seconde ; on ne
 * veut pas basculer en dégradé sur une simple lenteur, seulement casser les blocages.
 */
export const AUTH_BOOT_TIMEOUT_MS = 10_000;

/** Budget de `auth.getSession()` / `refreshSession()` — sous le plafond dur ci-dessus. */
export const SESSION_TIMEOUT_MS = 8_000;

/** Plafond de lecture du profil (persona, infos perso, pays). */
export const PROFILE_TIMEOUT_MS = 6_000;

/** Délai avant la SEULE nouvelle tentative de lecture du profil après un échec/timeout. */
export const PROFILE_RETRY_DELAY_MS = 2_500;

/**
 * Indice « une session a déjà été confirmée sur ce navigateur » (localStorage).
 * Même clé que le squelette du shell, qui l'utilisait déjà pour réserver la place de la
 * sidebar : l'indice devient la source unique, maintenue par la couche auth.
 */
export const SESSION_HINT_KEY = 'medinfo.shell.hadSession';

/** Stockage minimal (localStorage web) — injectable pour les tests. */
export interface HintStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): HintStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage ?? null;
  } catch {
    // Safari en navigation privée / stockage bloqué : pas d'indice, jamais d'exception.
    return null;
  }
}

/** La session a-t-elle déjà été confirmée sur ce navigateur ? (false si stockage indispo) */
export function readSessionHint(storage: HintStorage | null = defaultStorage()): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(SESSION_HINT_KEY) === '1';
  } catch {
    return false;
  }
}

/** Mémorise (ou efface) l'indice de session. Best-effort : jamais d'exception. */
export function writeSessionHint(
  hasSession: boolean,
  storage: HintStorage | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    if (hasSession) storage.setItem(SESSION_HINT_KEY, '1');
    else storage.removeItem(SESSION_HINT_KEY);
  } catch {
    // Stockage indisponible : l'indice n'est simplement pas mémorisé.
  }
}

/**
 * Résultat d'une étape d'amorçage bornée dans le temps : `timedOut` distingue
 * explicitement « pas de réponse à temps » (session peut-être valide, à récupérer) de
 * « réponse négative » (réellement pas de session) — les deux ne doivent PAS conduire au
 * même comportement d'interface (rediriger vers la connexion serait faux dans le 1er cas).
 */
export interface TimedResult<T> {
  value: T;
  timedOut: boolean;
}

/**
 * Borne une promesse dans le temps SANS jamais rejeter : au-delà de `ms`, renvoie
 * `fallback` avec `timedOut: true` ; un rejet renvoie `fallback` avec `timedOut: false`
 * (la réponse est arrivée, elle est juste en erreur). Le minuteur est toujours nettoyé
 * (pas de handle qui traîne côté Node/tests).
 */
export function withTimeout<T>(
  promise: PromiseLike<T>,
  ms: number,
  fallback: T,
): Promise<TimedResult<T>> {
  return new Promise<TimedResult<T>>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ value: fallback, timedOut: true });
    }, ms);

    const finish = (result: TimedResult<T>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    Promise.resolve(promise).then(
      (value) => finish({ value, timedOut: false }),
      () => finish({ value: fallback, timedOut: false }),
    );
  });
}

/**
 * Clés de stockage du token Supabase pour ce projet. supabase-js les dérive de l'URL :
 * `sb-<premier label d'hôte>-auth-token` (+ variantes `-code-verifier` / `-user`).
 *
 * Sert à la réinitialisation de session : `auth.signOut({ scope: 'local' })` appelle
 * malgré tout `/logout` sur le réseau et peut donc PENDRE — exactement la panne qu'on
 * corrige. L'échappatoire doit donc pouvoir effacer le token SANS réseau, ce que faisait
 * l'utilisateur à la main en vidant les cookies.
 */
export function supabaseAuthStorageKeys(supabaseUrl: string | undefined | null): string[] {
  if (!supabaseUrl) return [];
  try {
    const ref = new URL(supabaseUrl).hostname.split('.')[0];
    if (!ref) return [];
    const base = `sb-${ref}-auth-token`;
    return [base, `${base}-code-verifier`, `${base}-user`];
  } catch {
    return [];
  }
}

/**
 * Efface le token Supabase stocké + l'indice de session, sans aucun appel réseau.
 * Renvoie true si au moins une clé a pu être retirée.
 */
export function clearStoredSession(
  supabaseUrl: string | undefined | null,
  storage: HintStorage | null = defaultStorage(),
): boolean {
  if (!storage) return false;
  let removed = false;
  for (const key of supabaseAuthStorageKeys(supabaseUrl)) {
    try {
      if (storage.getItem(key) !== null) removed = true;
      storage.removeItem(key);
    } catch {
      // clé verrouillée : on continue, l'échappatoire ne doit jamais lever
    }
  }
  writeSessionHint(false, storage);
  return removed;
}

/**
 * Signal d'annulation borné dans le temps, quand la plateforme le permet : il LIBÈRE
 * réellement la requête HTTP pendante (sinon le socket reste ouvert et le plafond de
 * temps ne fait que masquer le blocage). `undefined` si `AbortSignal.timeout` est absent.
 */
export function abortAfter(ms: number): AbortSignal | undefined {
  const ctor = typeof AbortSignal !== 'undefined' ? AbortSignal : null;
  if (!ctor || typeof ctor.timeout !== 'function') return undefined;
  try {
    return ctor.timeout(ms);
  } catch {
    return undefined;
  }
}
