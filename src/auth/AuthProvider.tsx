/**
 * AuthProvider — état Supabase Auth + persona (étape 3).
 *
 * Magic link OTP email (ADR-0007, étudiants). Expose la persona lue dans `profiles`
 * (RLS : le user ne lit que SA ligne). Aucune donnée de santé manipulée ici.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';

import { getSupabaseClient } from '@/db/supabase';
import type { Persona } from '@/ai/prompts/_schema';

export interface SessionState {
  session: Session | null;
  user: User | null;
  persona: Persona | null;
  loading: boolean;
  signInWithEmail: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<SessionState | null>(null);

async function fetchPersona(userId: string): Promise<Persona> {
  const supabase = getSupabaseClient();
  const { data } = await supabase.from('profiles').select('persona').eq('id', userId).single();
  return (data?.persona as Persona) ?? 'public';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseClient();
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session?.user) setPersona(await fetchPersona(data.session.user.id));
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, next) => {
      if (!active) return;
      setSession(next);
      setPersona(next?.user ? await fetchPersona(next.user.id) : null);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<SessionState>(
    () => ({
      session,
      user: session?.user ?? null,
      persona,
      loading,
      async signInWithEmail(email: string) {
        const supabase = getSupabaseClient();
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim().toLowerCase(),
          options: { emailRedirectTo: Linking.createURL('/') },
        });
        return { error: error?.message ?? null };
      },
      async signOut() {
        await getSupabaseClient().auth.signOut();
      },
    }),
    [session, persona, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useSession doit être utilisé dans <AuthProvider>.');
  return ctx;
}
