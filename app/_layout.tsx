import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { MedInfoThemeProvider } from '@/ui/MedInfoThemeProvider';
import { AuthProvider, useSession } from '@/auth/AuthProvider';
import { resolvePersonaRoute } from '@/ai/routing/persona';

/**
 * Garde de navigation par persona (02_ARCHITECTURE §4).
 * - non authentifié → groupe (auth)
 * - public / student → groupe (chat)
 * - professional → reporté (ADR-0006) : maintenu hors (chat), redirigé vers (account),
 *   aucune surface UI pro servie.
 */
function useProtectedRoute() {
  const { session, persona, loading, passwordRecovery } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';
    // Groupes publics accessibles sans session : accueil (landing/hero), authentification et
    // pages légales (LCEN art. 6 : mentions légales accessibles à tous ; la landing avec ses
    // CTA « Se connecter »/« Ouvrir le chat » doit rester visible déconnecté).
    const inPublicGroup = inAuthGroup || segments[0] === undefined || segments[0] === '(legal)';

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
      router.replace(resolution?.allowed ? '/(chat)/chat' : '/(account)/account');
    } else if (resolution && !resolution.allowed && segments[0] === '(chat)') {
      // Persona reportée (professional) : pas d'accès au chat MVP.
      router.replace('/(account)/account');
    }
  }, [session, persona, loading, passwordRecovery, segments, router]);
}

function RootNavigator() {
  useProtectedRoute();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(chat)" />
      <Stack.Screen name="(account)" />
      <Stack.Screen name="(billing)" />
      <Stack.Screen name="(legal)" />
      <Stack.Screen name="(admin)" />
    </Stack>
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
    </SafeAreaProvider>
  );
}
