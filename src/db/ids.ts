/**
 * Validation d'identifiants base de données — source unique.
 *
 * Le format UUID attendu pour les ids transmis par le client (conversation, deck…)
 * est défini ici une seule fois pour éviter que la regex se duplique et dérive d'un
 * module à l'autre.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Renvoie la valeur si c'est un UUID bien formé transmis par le client, sinon null. */
export function coerceUuid(value: unknown): string | null {
  return typeof value === 'string' && UUID_RE.test(value) ? value : null;
}
