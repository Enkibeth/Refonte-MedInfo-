import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as Linking from 'expo-linking';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';

import { createBrowserSupabaseClient } from '@/db/supabase';

type Persona = 'public' | 'student' | 'professional';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  persona: Persona;
  loading: boolean;
  signInWithEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

type AuthProviderProps = {
  children: ReactNode;
};

const AuthContext = createContext<AuthContextValue | null>(null);
let cachedClient: SupabaseClient | null = null;

function getSupabaseClient() {
  if (!cachedClient) {
    cachedClient = createBrowserSupabaseClient();
  }

  return cachedClient;
}

function readPersona(user: User | null): Persona {
  const rawPersona = user?.user_metadata?.persona;

  if (rawPersona === 'student' || rawPersona === 'professional') {
    return rawPersona;
  }

  return 'public';
}

function getEmailRedirectTo() {
  return Linking.createURL('/');
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const supabase = (() => {
      try {
        return getSupabaseClient();
      } catch {
        return null;
      }
    })();

    if (!supabase) {
      setLoading(false);

      return () => {
        isMounted = false;
      };
    }

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!isMounted) return;
        setSession(data.session);
        setLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signInWithEmail = useCallback(async (email: string) => {
    const normalizedEmail = email.trim().toLowerCase();

    const { error } = await getSupabaseClient().auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: getEmailRedirectTo(),
      },
    });

    if (error) {
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await getSupabaseClient().auth.signOut();

    if (error) {
      throw error;
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const user = session?.user ?? null;

    return {
      session,
      user,
      persona: readPersona(user),
      loading,
      signInWithEmail,
      signOut,
    };
  }, [loading, session, signInWithEmail, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useSession() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error('useSession must be used within AuthProvider.');
  }

  return value;
}
