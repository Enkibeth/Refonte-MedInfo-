/**
 * Résolution de la persona EFFECTIVE côté serveur (CC-01, audit Council §INV-A).
 *
 * Invariant : la persona qui pilote le safe-box (exception `allowFictiveEducationalCases`,
 * matrice d'outils, quota) est dérivée du PROFIL VÉRIFIÉ, jamais du body client.
 *
 * - Appel anonyme (pas de token valide) → toujours `public`, quel que soit `body.persona`.
 * - Appel authentifié → persona lue dans `profiles.persona` (écrite côté serveur uniquement,
 *   après vérification, ADR-0011). `professional` n'étant pas servi par la route chat MVP
 *   (04_CHATBOT §8, gel ADR-0006), il est ramené à `public`.
 *
 * Le champ `body.persona` n'est conservé que comme intention déclarée (audit) : toute demande
 * d'une persona plus privilégiée que celle accordée est signalée (`attemptedElevation`).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Persona } from '@/ai/prompts/_schema';
import { resolveVerifiedUserId } from '@/auth/serverIdentity';
import { createServerSupabaseClient } from '@/db/serverSupabase';

/** Personas réellement servables par la route chat MVP (04_CHATBOT §8). */
export const CHAT_PERSONAS: Persona[] = ['public', 'student'];

export interface ServerPersonaResolution {
  /** Persona effective dérivée du serveur — la SEULE à utiliser pour toute autorisation. */
  persona: Persona;
  /** true si un token valide a identifié un profil. */
  verified: boolean;
  /** Persona demandée par le client (intention déclarée, jamais une autorisation). */
  requested: Persona;
  /** true si le client a demandé une persona plus privilégiée que celle accordée. */
  attemptedElevation: boolean;
}

export interface ResolveChatPersonaDeps {
  /** Injection de test. Si absent, un client service_role est créé depuis l'environnement. */
  supabase?: SupabaseClient | null;
}

/** Niveau de privilège (public < student). `professional` non servi par le chat MVP. */
const PRIVILEGE: Record<Persona, number> = { public: 0, student: 1, professional: 2 };

function coerceRequestedPersona(value: unknown): Persona {
  if (value === 'student') return 'student';
  if (value === 'professional') return 'professional';
  return 'public';
}

async function fetchProfilePersona(supabase: SupabaseClient, userId: string): Promise<Persona> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('persona')
      .eq('id', userId)
      .maybeSingle();
    const persona = (data as { persona?: unknown } | null)?.persona;
    if (persona === 'student' || persona === 'professional' || persona === 'public') {
      return persona;
    }
    return 'public';
  } catch {
    // Profil illisible (table absente, env partiel) → fail-safe le moins privilégié.
    return 'public';
  }
}

export async function resolveChatPersona(
  request: Request,
  requestedRaw: unknown,
  deps: ResolveChatPersonaDeps = {},
): Promise<ServerPersonaResolution> {
  const requested = coerceRequestedPersona(requestedRaw);
  const supabase = 'supabase' in deps ? deps.supabase ?? null : createServerSupabaseClient();

  const userId = supabase ? await resolveVerifiedUserId(request, supabase) : null;

  // Anonyme → public strict, même si le body réclame une persona privilégiée.
  if (!supabase || !userId) {
    return {
      persona: 'public',
      verified: false,
      requested,
      attemptedElevation: PRIVILEGE[requested] > PRIVILEGE.public,
    };
  }

  const profilePersona = await fetchProfilePersona(supabase, userId);
  // `professional` n'est pas servi par le chat MVP → ramené à `public`.
  const persona: Persona = (CHAT_PERSONAS as string[]).includes(profilePersona)
    ? profilePersona
    : 'public';

  return {
    persona,
    verified: true,
    requested,
    attemptedElevation: PRIVILEGE[requested] > PRIVILEGE[persona],
  };
}
