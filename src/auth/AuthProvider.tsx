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

/**
 * Convertit un message d'erreur Supabase/réseau brut en message FR clair et actionnable.
 * Évite de laisser fuiter des libellés techniques (« Type error », « Failed to fetch »…)
 * dans l'UI (cf retour terrain : « Type error » à la connexion).
 */
export function toFriendlyAuthError(raw: unknown): string {
  const message =
    raw instanceof Error ? raw.message : typeof raw === 'string' ? raw : String(raw ?? '');
  const m = message.toLowerCase();

  if (
    m.includes('failed to fetch') ||
    m.includes('load failed') ||
    m.includes('networkerror') ||
    m.includes('network request failed') ||
    m === 'type error' ||
    m.includes('typeerror') ||
    m.includes('fetch')
  ) {
    return "Service d'authentification momentanément injoignable. Vérifie ta connexion et réessaie.";
  }
  if (m.includes('invalid login credentials')) return 'Email ou mot de passe incorrect.';
  if (m.includes('email not confirmed')) return 'Email non confirmé. Vérifie ta boîte mail (et les spams).';
  if (m.includes('user already registered')) return 'Un compte existe déjà avec cet email. Connecte-toi.';
  if (m.includes('password should be') || m.includes('at least 6')) return 'Mot de passe trop court (6 caractères minimum).';
  if (m.includes('provider is not enabled') || m.includes('unsupported provider')) {
    return "Cette méthode de connexion n'est pas encore activée. Utilise l'email pour le moment.";
  }
  if (m.includes('rate limit') || m.includes('too many')) return 'Trop de tentatives. Patiente un instant avant de réessayer.';
  if (m.includes('for security purposes') || m.includes('seconds')) return message; // délai d'envoi email : message Supabase déjà lisible
  return message || 'Une erreur est survenue. Réessaie.';
}

/** Statut de vérification du rôle actif (profiles.status). */
export type VerificationStatus = 'unverified' | 'verified' | 'pending';

export interface SessionState {
  session: Session | null;
  user: User | null;
  persona: Persona | null;
  /** Statut de vérification du rôle actif (lu dans profiles). */
  status: VerificationStatus;
  /** Rôles déjà vérifiés pour ce compte — bascule libre entre leurs chats (migration 0016). */
  verifiedPersonas: Persona[];
  loading: boolean;
  /** True après l'ouverture d'un lien de réinitialisation (événement PASSWORD_RECOVERY). */
  passwordRecovery: boolean;
  /** Connexion email + mot de passe. */
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  /** Inscription email + mot de passe (confirmation email selon config Supabase). */
  signUpWithPassword: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  /** Renvoi de l'email de confirmation Supabase pour une inscription non confirmée. */
  resendSignupConfirmation: (email: string) => Promise<{ error: string | null }>;
  /** Envoi du lien de réinitialisation de mot de passe. */
  sendPasswordReset: (email: string) => Promise<{ error: string | null }>;
  /** Définit un nouveau mot de passe (session de récupération active). */
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  /** Sort du mode récupération (après mise à jour réussie). */
  clearPasswordRecovery: () => void;
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

interface ProfileState {
  persona: Persona;
  status: VerificationStatus;
  verifiedPersonas: Persona[];
}

async function fetchProfile(userId: string): Promise<ProfileState> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('profiles')
    .select('persona, status, verified_personas')
    .eq('id', userId)
    .single();
  const persona = (data?.persona as Persona) ?? 'public';
  const verified = (data?.verified_personas as Persona[] | null) ?? ['public'];
  return {
    persona,
    status: (data?.status as VerificationStatus) ?? 'unverified',
    verifiedPersonas: verified.includes('public') ? verified : ['public', ...verified],
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [status, setStatus] = useState<VerificationStatus>('unverified');
  const [verifiedPersonas, setVerifiedPersonas] = useState<Persona[]>(['public']);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  function applyProfile(p: ProfileState | null) {
    setPersona(p?.persona ?? null);
    setStatus(p?.status ?? 'unverified');
    setVerifiedPersonas(p?.verifiedPersonas ?? ['public']);
  }

  useEffect(() => {
    const supabase = getSupabaseClient();
    let active = true;

    // Charge la session + le profil et garantit que `loading` repasse à false même
    // si `fetchProfile` échoue (réseau/RLS). Sans ce try/finally, une erreur ici
    // laissait le spinner tourner indéfiniment (email « Mon compte », écrans <RoleGate>).
    async function hydrate(next: Session | null) {
      if (!active) return;
      setSession(next);
      try {
        applyProfile(next?.user ? await fetchProfile(next.user.id) : null);
      } catch {
        // Profil illisible : on retombe sur un état neutre plutôt que de bloquer l'UI.
        if (active) applyProfile(next?.user ? { persona: 'public', status: 'unverified', verifiedPersonas: ['public'] } : null);
      } finally {
        if (active) setLoading(false);
      }
    }

    supabase.auth
      .getSession()
      .then(({ data }) => hydrate(data.session))
      .catch(() => {
        // getSession lui-même peut rejeter (réseau) : ne jamais rester bloqué sur loading.
        if (active) setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, next) => {
      if (!active) return;
      // Lien de réinitialisation ouvert : on bascule en mode récupération (cf garde de route).
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      await hydrate(next);
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
      status,
      verifiedPersonas,
      loading,
      passwordRecovery,
      async signInWithPassword(email: string, password: string) {
        try {
          const supabase = getSupabaseClient();
          const { error } = await supabase.auth.signInWithPassword({
            email: email.trim().toLowerCase(),
            password,
          });
          return { error: error ? toFriendlyAuthError(error.message) : null };
        } catch (e) {
          return { error: toFriendlyAuthError(e) };
        }
      },
      async signUpWithPassword(email: string, password: string) {
        try {
          const supabase = getSupabaseClient();
          const { data, error } = await supabase.auth.signUp({
            email: email.trim().toLowerCase(),
            password,
            options: { emailRedirectTo: getAuthRedirectTo() },
          });
          // Si la confirmation email est activée, la session est nulle jusqu'à confirmation.
          return {
            error: error ? toFriendlyAuthError(error.message) : null,
            needsConfirmation: !error && !data.session,
          };
        } catch (e) {
          return { error: toFriendlyAuthError(e), needsConfirmation: false };
        }
      },
      async resendSignupConfirmation(email: string) {
        try {
          const supabase = getSupabaseClient();
          const { error } = await supabase.auth.resend({
            type: 'signup',
            email: email.trim().toLowerCase(),
            options: { emailRedirectTo: getAuthRedirectTo() },
          });
          return { error: error ? toFriendlyAuthError(error.message) : null };
        } catch (e) {
          return { error: toFriendlyAuthError(e) };
        }
      },
      async sendPasswordReset(email: string) {
        try {
          const supabase = getSupabaseClient();
          // redirectTo = Site URL (déjà autorisée) : la session de récupération est captée
          // au retour via l'événement PASSWORD_RECOVERY, qui route vers l'écran dédié.
          const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
            redirectTo: getAuthRedirectTo(),
          });
          return { error: error ? toFriendlyAuthError(error.message) : null };
        } catch (e) {
          return { error: toFriendlyAuthError(e) };
        }
      },
      async updatePassword(password: string) {
        try {
          const supabase = getSupabaseClient();
          const { error } = await supabase.auth.updateUser({ password });
          return { error: error ? toFriendlyAuthError(error.message) : null };
        } catch (e) {
          return { error: toFriendlyAuthError(e) };
        }
      },
      clearPasswordRecovery() {
        setPasswordRecovery(false);
      },
      async signInWithOAuth(provider: OAuthProvider) {
        try {
          const supabase = getSupabaseClient();
          const { error } = await supabase.auth.signInWithOAuth({
            provider,
            options: { redirectTo: getAuthRedirectTo() },
          });
          return { error: error ? toFriendlyAuthError(error.message) : null };
        } catch (e) {
          return { error: toFriendlyAuthError(e) };
        }
      },
      async signInWithEmail(email: string) {
        try {
          const supabase = getSupabaseClient();
          const { error } = await supabase.auth.signInWithOtp({
            email: email.trim().toLowerCase(),
            options: { emailRedirectTo: getAuthRedirectTo() },
          });
          return { error: error ? toFriendlyAuthError(error.message) : null };
        } catch (e) {
          return { error: toFriendlyAuthError(e) };
        }
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
          const nextPersona = (data?.persona as Persona) ?? persona;
          setPersona(nextPersona);
          setStatus((data?.status as VerificationStatus) ?? 'verified');
          if (Array.isArray(data?.verifiedPersonas)) {
            setVerifiedPersonas(data.verifiedPersonas as Persona[]);
          } else {
            setVerifiedPersonas((prev) =>
              prev.includes(nextPersona) ? prev : [...prev, nextPersona],
            );
          }
          return { error: null };
        } catch (e) {
          return { error: e instanceof Error ? e.message : 'Erreur réseau.' };
        }
      },
      async signOut() {
        await getSupabaseClient().auth.signOut();
      },
    }),
    [session, persona, status, verifiedPersonas, loading, passwordRecovery],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useSession doit être utilisé dans <AuthProvider>.');
  return ctx;
}
