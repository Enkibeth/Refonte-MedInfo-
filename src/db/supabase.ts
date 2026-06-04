import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export function createBrowserSupabaseClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // true : nécessaire sur web pour consommer le token du callback (magic link / OAuth)
      // et établir la session. À false, la session ne s'établissait jamais → reconnexion
      // perçue à chaque fois.
      detectSessionInUrl: true,
    },
  });
}

let cached: SupabaseClient | null = null;

/**
 * Client navigateur singleton (clé `anon`, protégée par la RLS — 03_SECURITY §4).
 * La clé `service_role` n'est JAMAIS utilisée côté client : uniquement serveur/Edge.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!cached) cached = createBrowserSupabaseClient();
  return cached;
}
