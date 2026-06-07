/**
 * Identité serveur vérifiée — source unique de la vérification de token (CC-01).
 *
 * Règle sécurité (ADR-0011, audit Council §INV-A) : aucune autorisation (persona, rôle,
 * quota) ne doit dépendre d'un champ contrôlé par le client. La seule identité de confiance
 * est celle dérivée d'un Bearer token validé par Supabase Auth côté serveur.
 *
 * Ce module ne lit jamais le body de la requête : il ne fait que résoudre l'utilisateur
 * authentifié (ou `null` pour un appel anonyme).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/** Extrait le token d'un header `Authorization: Bearer <token>`. `null` si absent/malformé. */
export function getBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

/**
 * Résout l'`user.id` vérifié à partir du Bearer token. Retourne `null` si aucun token,
 * token invalide/expiré, ou erreur Supabase — jamais une identité non vérifiée.
 */
export async function resolveVerifiedUserId(
  request: Request,
  supabase: SupabaseClient,
): Promise<string | null> {
  const token = getBearerToken(request);
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error) return null;
  return data.user?.id ?? null;
}
