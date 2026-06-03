/**
 * Hook session : retourne user + persona depuis Supabase Auth (étape 3).
 * Le persona est stocké dans user_metadata.persona à l'inscription.
 * Par défaut 'public' (utilisateur anonyme ou non profilé).
 */
import { useEffect, useState } from 'react';

import { createBrowserSupabaseClient } from '@/db/supabase';
import type { Persona } from '@/ai/prompts/_schema';

export interface SessionState {
  userId?: string;
  persona: Persona;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const VALID_PERSONAS: Persona[] = ['public', 'student'];

function resolvePersona(raw: unknown): Persona {
  if (typeof raw === 'string' && (VALID_PERSONAS as string[]).includes(raw)) {
    return raw as Persona;
  }
  return 'public';
}

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({
    persona: 'public',
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    let supabase: ReturnType<typeof createBrowserSupabaseClient> | null = null;

    try {
      supabase = createBrowserSupabaseClient();
    } catch {
      setState({ persona: 'public', isAuthenticated: false, isLoading: false });
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setState({
        userId: session?.user.id,
        persona: resolvePersona(session?.user.user_metadata?.persona),
        isAuthenticated: !!session,
        isLoading: false,
      });
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({
        userId: session?.user.id,
        persona: resolvePersona(session?.user.user_metadata?.persona),
        isAuthenticated: !!session,
        isLoading: false,
      });
    });

    return () => subscription.unsubscribe();
  }, []);

  return state;
}
