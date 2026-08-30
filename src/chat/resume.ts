/**
 * Reprise d'une réponse coupée par la mise en veille du téléphone (2026-08).
 *
 * Le cas réel (retour Hugo) : on pose une question, on quitte Safari. iOS gèle la page et
 * peut couper le flux HTTP en cours. Côté serveur la génération va au bout — `keepAlive`
 * prolonge l'invocation (maxDuration 300 s) et `onFinish` archive la réponse complète.
 *
 * Côté client, deux issues distinctes au retour :
 *   1. le flux casse avec une ERREUR → la reprise existante se déclenche et va chercher la
 *      réponse archivée (startRecovery) ;
 *   2. le flux se termine SILENCIEUSEMENT — le fetch est avorté sans erreur, `useChat`
 *      repasse simplement en « prêt ». L'utilisateur reste alors devant une réponse
 *      TRONQUÉE, sans le moindre signal : c'est le cas que ce module traite.
 *
 * On ne peut pas distinguer une réponse tronquée d'une réponse complète en la regardant.
 * On la compare donc à ce que le serveur a archivé, et on ne remplace QUE si l'archive est
 * manifestement la même réponse en plus complet. Module PUR (aucun réseau, aucun état) :
 * testé dans tests/unit/chat-resume.test.ts.
 */

/**
 * Longueur du préfixe comparé pour reconnaître « la même réponse ».
 *
 * Sans cette garde, une régénération pourrait se faire écraser par l'archive de la réponse
 * PRÉCÉDENTE si celle-ci était plus longue. On exige donc que l'archive commence comme le
 * texte affiché : deux générations différentes divergent presque toujours dès les premiers
 * mots, une réponse tronquée est par construction un préfixe de la réponse complète.
 */
export const RESUME_PREFIX_LEN = 60;

/** Normalise pour la comparaison de préfixe : espaces compactés, casse ignorée. */
function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Faut-il remplacer le texte affiché par la version archivée côté serveur ?
 *
 * @param local    texte de la dernière réponse assistant affichée (éventuellement tronquée)
 * @param archived texte de la dernière réponse assistant archivée par /api/chat
 */
export function shouldReplaceWithArchived(
  local: string | null | undefined,
  archived: string | null | undefined,
): boolean {
  const a = normalize(archived ?? '');
  if (!a) return false; // Rien d'archivé : il n'y a rien de mieux à afficher.

  const l = normalize(local ?? '');
  if (!l) return true; // Rien à l'écran : l'archive est forcément un progrès.

  // L'archive doit être STRICTEMENT plus complète.
  if (a.length <= l.length) return false;

  // …et être la même réponse : une troncature est un préfixe de la version complète.
  const len = Math.min(RESUME_PREFIX_LEN, l.length);
  return a.slice(0, len) === l.slice(0, len);
}
