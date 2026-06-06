import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * L'URL et la clé sont envoyées telles quelles dans des en-têtes HTTP (`apikey`,
 * `Authorization`). Or un en-tête HTTP n'accepte que des octets ISO-8859-1 : si la
 * valeur saisie dans Vercel contient un caractère non-ASCII (ex. un sosie cyrillique
 * « У/А/С » collé à la place d'un « Y/A/C » latin), le navigateur lève une TypeError
 * au moment du `fetch`. Cette erreur remontait à l'UI sous le message trompeur
 * « Vérifie ta connexion » alors que le réseau de l'utilisateur n'est pas en cause.
 * On la détecte ici pour échouer tôt, avec un message qui pointe la vraie cause.
 */
function assertHeaderSafe(value: string, varName: string): string {
  const trimmed = value.trim();
  const badIndex = [...trimmed].findIndex((ch) => ch.charCodeAt(0) > 0xff);
  if (badIndex !== -1) {
    const bad = trimmed[badIndex];
    const code = bad.codePointAt(0)?.toString(16).padStart(4, '0');
    throw new Error(
      `${varName} contient un caractère non-ASCII (« ${bad} », U+${code}, position ${badIndex}) — ` +
        'probablement un sosie unicode (cyrillique/grec) à la place d\'une lettre latine. ' +
        'Ressaisis la valeur en ASCII pur dans les variables d\'environnement Vercel.',
    );
  }
  return trimmed;
}

export function createBrowserSupabaseClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  }

  const url = assertHeaderSafe(supabaseUrl, 'EXPO_PUBLIC_SUPABASE_URL');
  const anonKey = assertHeaderSafe(supabaseAnonKey, 'EXPO_PUBLIC_SUPABASE_ANON_KEY');

  return createClient(url, anonKey, {
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
