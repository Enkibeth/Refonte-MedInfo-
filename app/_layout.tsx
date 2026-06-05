import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

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
  const { session, persona, loading } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';

    if (!session) {
      if (!inAuthGroup) router.replace('/(auth)/sign-in');
      return;
    }

    const resolution = persona ? resolvePersonaRoute(persona) : null;
    if (inAuthGroup) {
      router.replace(resolution?.allowed ? '/(chat)/chat' : '/(account)/account');
    } else if (resolution && !resolution.allowed && segments[0] === '(chat)') {
      // Persona reportée (professional) : pas d'accès au chat MVP.
      router.replace('/(account)/account');
    }
  }, [session, persona, loading, segments, router]);
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
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <MedInfoThemeProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
      <StatusBar style="auto" />
    </MedInfoThemeProvider>
  );
}
