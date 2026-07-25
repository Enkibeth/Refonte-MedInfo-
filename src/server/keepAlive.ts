/**
 * Maintien en vie d'un traitement serveur après la déconnexion du client.
 *
 * Problème (retour Hugo 2026-07) : sur mobile, quitter le navigateur suspend la page et
 * coupe le flux HTTP. `/api/chat` appelait bien `result.consumeStream()` pour que la
 * génération aille au bout et soit archivée par `onFinish` — mais sur une plateforme
 * serverless, l'invocation est GELÉE dès que la réponse HTTP est terminée ou avortée :
 * le travail restant ne s'exécute jamais et l'utilisateur ne retrouve rien dans son
 * historique. La primitive prévue pour ça est `waitUntil`, qui prolonge l'invocation
 * jusqu'à la résolution de la promesse.
 *
 * Implémentation : Vercel expose le contexte de requête sur un symbole global. C'est
 * exactement ce que fait `@vercel/functions` (`wait-until.js` → `get-context.js`,
 * vérifié sur la version 3.7.6 publiée) — on le lit directement plutôt que d'ajouter une
 * dépendance pour trois lignes, ce qui évite aussi tout couplage de version.
 *
 * Hors plateforme (dev local, tests, autre hébergeur) : no-op, le processus reste vivant
 * de lui-même. La fonction ne LANCE jamais et n'attend jamais — elle ne doit en aucun cas
 * retarder la réponse envoyée à l'utilisateur.
 */

/** Symbole du contexte de requête Vercel (cf. `@vercel/functions/get-context`). */
export const VERCEL_REQUEST_CONTEXT = Symbol.for('@vercel/request-context');

type RequestContext = { waitUntil?: (promise: Promise<unknown>) => void };
type ContextHolder = { get?: () => RequestContext | undefined };

/**
 * Prolonge l'invocation jusqu'à la fin de `promise`.
 * @returns `true` si la plateforme a pris la relève, `false` si no-op (dev/local).
 * Accepte tout thenable : `consumeStream()` renvoie un `PromiseLike`.
 */
export function keepAlive(promise: PromiseLike<unknown>): boolean {
  if (!promise || typeof (promise as PromiseLike<unknown>).then !== 'function') return false;
  // Un rejet non capté sur une promesse détachée peut faire tomber le processus :
  // on neutralise l'erreur ici (l'appelant a déjà son propre traitement d'erreur).
  const settled = Promise.resolve(promise).then(
    () => undefined,
    () => undefined,
  );
  try {
    const holder = (globalThis as unknown as Record<symbol, ContextHolder | undefined>)[
      VERCEL_REQUEST_CONTEXT
    ];
    const waitUntil = holder?.get?.()?.waitUntil;
    if (typeof waitUntil === 'function') {
      waitUntil(settled);
      return true;
    }
  } catch {
    // Contexte absent ou illisible → repli silencieux.
  }
  return false;
}
