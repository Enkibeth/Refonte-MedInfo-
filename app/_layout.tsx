import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';

import { MedInfoThemeProvider } from '@/ui/MedInfoThemeProvider';
import { AuthProvider, useSession } from '@/auth/AuthProvider';
import { resolvePersonaRoute } from '@/ai/routing/persona';
import { AppShell } from '@/ui/shell/AppShell';
import { isVercelAnalyticsEnabled } from '@/deploy/target';

/**
 * Garde de navigation par persona (02_ARCHITECTURE §4).
 * - non authentifié → groupe (auth)
 * - public / student → groupe (chat)
 * - professional → reporté (ADR-0006) : maintenu hors (chat), redirigé vers (account),
 *   aucune surface UI pro servie.
 */
function useProtectedRoute() {
  const { session, persona, loading, bootDegraded, passwordRecovery } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    // Amorçage dégradé (session probable mais pas encore récupérée, cf. bootGuard) :
    // surtout NE PAS rediriger vers la connexion — l'utilisateur EST connecté, sa session
    // est en cours de récupération. L'écran courant reste affiché ; la redirection se fera
    // normalement dès que `onAuthStateChange` livre la session (l'état dégradé se lève).
    if (bootDegraded && !session) return;
    // Session connue mais profil pas encore appliqué : la persona arrive au tour suivant
    // (le repli neutre garantit qu'elle ne reste jamais nulle). Sans cette garde, la
    // redirection post-connexion partait vers « Mon compte » au lieu de la Vue d'ensemble,
    // faute de persona résolue au moment du calcul.
    if (session && !persona) return;
    const inAuthGroup = segments[0] === '(auth)';
    // Groupes publics accessibles sans session : accueil (landing/hero), authentification,
    // pages légales (LCEN art. 6 : mentions légales accessibles à tous) et le groupe (chat) —
    // essai sans inscription (2026-06) : un visiteur peut envoyer UN message gratuit dans le
    // chat ; les autres écrans du groupe restent verrouillés par <RoleGate> (isGuest).
    const inPublicGroup =
      inAuthGroup ||
      segments[0] === undefined ||
      segments[0] === '(legal)' ||
      segments[0] === '(chat)' ||
      // Tarifs : page marketing publique et indexable (header public + SEO). L'écran
      // gère lui-même le visiteur (« S'abonner » → création de compte) ; sans ce
      // groupe, un visiteur cliquant « Tarifs » était renvoyé vers sign-in.
      segments[0] === '(billing)' ||
      // Pages marketing publiques (audit landing 2026-06) : à propos, contact, blog.
      segments[0] === '(marketing)';

    // Mode récupération de mot de passe : prioritaire sur toute autre redirection.
    if (passwordRecovery) {
      const onResetScreen = (segments as string[])[1] === 'reset-password';
      if (!onResetScreen) router.replace('/(auth)/reset-password');
      return;
    }

    if (!session) {
      if (!inPublicGroup) router.replace('/(auth)/sign-in');
      return;
    }

    const resolution = persona ? resolvePersonaRoute(persona) : null;
    if (inAuthGroup) {
      // Post-connexion : atterrissage sur la Vue d'ensemble (refonte shell 2026-07).
      router.replace(resolution?.allowed ? '/(chat)/dashboard' : '/(account)/account');
    } else if (resolution && !resolution.allowed && segments[0] === '(chat)') {
      // Persona reportée (professional) : pas d'accès au chat MVP.
      router.replace('/(account)/account');
    }
  }, [session, persona, loading, bootDegraded, passwordRecovery, segments, router]);
}

function RootNavigator() {
  useProtectedRoute();
  return (
    // Shell applicatif (sidebar + top bar) : actif seulement sur desktop web,
    // session ouverte et groupes applicatifs — transparent partout ailleurs.
    <AppShell>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(chat)" />
        <Stack.Screen name="(account)" />
        <Stack.Screen name="(billing)" />
        <Stack.Screen name="(legal)" />
        <Stack.Screen name="(marketing)" />
        <Stack.Screen name="(admin)" />
      </Stack>
    </AppShell>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <MedInfoThemeProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
        <StatusBar style="auto" />
      </MedInfoThemeProvider>
      {/* Web Analytics + Speed Insights Vercel : web uniquement (no-op natif), et
          seulement si le site est SERVI par Vercel — sur un hébergement Node autonome
          (Hostinger), leurs scripts n'existent pas et échouent en 404 à chaque page. */}
      {Platform.OS === 'web' && isVercelAnalyticsEnabled() && (
        <>
          <Analytics />
          <SpeedInsights />
        </>
      )}
    </SafeAreaProvider>
  );
}
