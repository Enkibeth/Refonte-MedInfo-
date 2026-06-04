/**
 * AuthProvider — état Supabase Auth + persona.
 *
 * Méthodes de connexion (ADR-0010, remplace le magic-link seul d'ADR-0007) :
 *   - email + mot de passe (signInWithPassword / signUpWithPassword) ;
 *   - OAuth Google / Apple (signInWithOAuth, redirection web) ;
 *   - magic link conservé en option (signInWithEmail).
 * Expose la persona lue dans `profiles` (RLS : le user ne lit que SA ligne).
 * Aucune donnée de santé manipulée ici.
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

export function getAuthRedirectTo(): string {
  const configured = process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL?.trim();
  if (configured) return configured;
  return Linking.createURL('/');
}

export type OAuthProvider = 'google' | 'apple';

export interface SessionState {
  session: Session | null;
  user: User | null;
  persona: Persona | null;
  loading: boolean;
  /** Connexion email + mot de passe. */
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  /** Inscription email + mot de passe (confirmation email selon config Supabase). */
  signUpWithPassword: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  /** Renvoi de l'email de confirmation Supabase pour une inscription non confirmée. */
  resendSignupConfirmation: (email: string) => Promise<{ error: string | null }>;
  /** Connexion OAuth (Google / Apple), redirection web. */
  signInWithOAuth: (provider: OAuthProvider) => Promise<{ error: string | null }>;
  /** Magic link OTP (option conservée, ADR-0007). */
  signInWithEmail: (email: string) => Promise<{ error: string | null }>;
  /**
   * Demande d'attribution de rôle vérifié (ADR-0011). Délègue au serveur `/api/role` :
   * le client ne fixe JAMAIS persona/status lui-même. `pending` = vérif pro RPPS à venir.
   */
  requestRole: (
    persona: Persona,
    proof?: { email?: string; rpps?: string },
  ) => Promise<{ error: string | null; pending?: boolean; message?: string }>;
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
      async signInWithPassword(email: string, password: string) {
        const supabase = getSupabaseClient();
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        return { error: error?.message ?? null };
      },
      async signUpWithPassword(email: string, password: string) {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: { emailRedirectTo: getAuthRedirectTo() },
        });
        // Si la confirmation email est activée, la session est nulle jusqu'à confirmation.
        return {
          error: error?.message ?? null,
          needsConfirmation: !error && !data.session,
        };
      },
      async resendSignupConfirmation(email: string) {
        const supabase = getSupabaseClient();
        const { error } = await supabase.auth.resend({
          type: 'signup',
          email: email.trim().toLowerCase(),
          options: { emailRedirectTo: getAuthRedirectTo() },
        });
        return { error: error?.message ?? null };
      },
      async signInWithOAuth(provider: OAuthProvider) {
        const supabase = getSupabaseClient();
        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo: getAuthRedirectTo() },
        });
        return { error: error?.message ?? null };
      },
      async signInWithEmail(email: string) {
        const supabase = getSupabaseClient();
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim().toLowerCase(),
          options: { emailRedirectTo: getAuthRedirectTo() },
        });
        return { error: error?.message ?? null };
      },
      async requestRole(persona: Persona, proof?: { email?: string; rpps?: string }) {
        const token = session?.access_token;
        if (!token) return { error: 'Non authentifié.' };
        try {
          const res = await fetch('/api/role', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ persona, ...proof }),
          });
          const data = await res.json().catch(() => ({}));
          if (res.status === 202) {
            return { error: null, pending: true, message: data?.message };
          }
          if (!res.ok) {
            return { error: data?.error ?? 'Échec de la vérification.' };
          }
          setPersona((data?.persona as Persona) ?? persona);
          return { error: null };
        } catch (e) {
          return { error: e instanceof Error ? e.message : 'Erreur réseau.' };
        }
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
