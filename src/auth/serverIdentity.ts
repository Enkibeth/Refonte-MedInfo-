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
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Extrait le token d'un header `Authorization: Bearer <token>`. `null` si absent/malformé. */
export function getBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export interface UserScopedClient {
  /** Client Supabase scopé au token de la requête → la RLS own-row s'applique. */
  client: SupabaseClient;
  /** Id de l'utilisateur vérifié (jamais dérivé du body). */
  userId: string;
}

/**
 * Crée un client Supabase SCOPÉ AU TOKEN (clé anon + `Authorization` de la requête) de sorte
 * que la RLS soit la barrière réelle — jamais le `service_role`. Retourne soit `{ client, userId }`
 * vérifié, soit `{ response }` (503 backend absent / 401 token manquant ou invalide) prêt à renvoyer.
 *
 * Source unique pour toutes les routes qui ont besoin d'un client RLS au nom de l'utilisateur.
 */
export async function createUserScopedClient(
  request: Request,
): Promise<UserScopedClient | { response: Response }> {
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return { response: Response.json({ error: 'Backend non configuré.' }, { status: 503 }) };
  }
  const token = getBearerToken(request);
  if (!token) {
    return { response: Response.json({ error: 'Non authentifié.' }, { status: 401 }) };
  }
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    return { response: Response.json({ error: 'Session invalide.' }, { status: 401 }) };
  }
  return { client, userId: data.user.id };
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
