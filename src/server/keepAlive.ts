/**
 * Poursuite d'un traitement serveur après la déconnexion du client.
 *
 * Problème (retour Hugo 2026-07) : sur mobile, quitter le navigateur suspend la page et
 * coupe le flux HTTP. `/api/chat` doit malgré tout aller au bout de la génération pour que
 * `onFinish` archive la réponse — sinon l'utilisateur ne retrouve rien dans son historique
 * au retour dans l'app.
 *
 * Depuis la migration vers un serveur Node autonome (2026-08), c'est acquis : le processus
 * vit entre les requêtes, donc une promesse détachée continue de s'exécuter même quand la
 * réponse HTTP est avortée. Il n'y a plus rien à demander à la plateforme — l'ancienne
 * implémentation `waitUntil` (contexte de requête serverless) a été retirée avec Vercel.
 *
 * Il reste UNE chose à faire, et c'est la raison d'être de cette fonction : neutraliser un
 * éventuel rejet de la promesse détachée. Un `unhandledRejection` sur une promesse que plus
 * personne n'attend peut faire tomber le processus — et donc couper le service pour TOUS les
 * utilisateurs, pas seulement celui qui s'est déconnecté. L'appelant conserve son propre
 * traitement d'erreur sur la promesse d'origine.
 *
 * La fonction ne LANCE jamais et n'attend jamais : elle ne doit en aucun cas retarder la
 * réponse envoyée à l'utilisateur.
 */

/**
 * Laisse `promise` se terminer en arrière-plan sans risque pour le processus.
 * @returns `true` si un thenable a bien été pris en charge, `false` sinon.
 */
export function keepAlive(promise: PromiseLike<unknown>): boolean {
  if (!promise || typeof (promise as PromiseLike<unknown>).then !== 'function') return false;
  Promise.resolve(promise).then(
    () => undefined,
    () => undefined,
  );
  return true;
}
