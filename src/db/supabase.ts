import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Les en-têtes HTTP exigent de l'ISO-8859-1 (Latin-1). Une variable d'env qui contient un
 * caractère Unicode « sosie » (ex. cyrillique copié-collé à la place d'une lettre latine)
 * fait lever une TypeError au `fetch` (clé envoyée dans l'en-tête `apikey`), remontée à l'UI
 * sous le message trompeur « Vérifie ta connexion ». On échoue tôt avec la vraie cause.
 */
function assertHeaderSafe(value: string, varName: string): void {
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) > 255) {
      throw new Error(
        `${varName} contient un caractère non-Latin1 (position ${i}, « ${value[i]} »). ` +
          'Un caractère Unicode « sosie » s’est probablement glissé dans la variable : ' +
          'recopie la valeur en ASCII pur.',
      );
    }
  }
}

export function createBrowserSupabaseClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  }

  assertHeaderSafe(supabaseUrl, 'EXPO_PUBLIC_SUPABASE_URL');
  assertHeaderSafe(supabaseAnonKey, 'EXPO_PUBLIC_SUPABASE_ANON_KEY');

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
