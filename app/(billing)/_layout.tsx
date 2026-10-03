import { Platform } from 'react-native';
import { Stack } from 'expo-router';

import { SHELL_BREAKPOINT } from '@/ui/shell/AppShell';
import { useWindowWidth } from '@/ui/useWindowWidth';

export default function BillingLayout() {
  const width = useWindowWidth();
  // Sous le shell desktop (sidebar + fil d'Ariane), l'en-tête natif ferait doublon ; sur le
  // web hors shell, la page porte déjà l'en-tête du site (LandingHeader) — une barre
  // « Offres » en plus doublait la navigation et le titre de niveau 1.
  const inShell = Platform.OS === 'web' && width >= SHELL_BREAKPOINT;
  return <Stack screenOptions={{ title: 'Offres', headerShown: Platform.OS !== 'web' && !inShell }} />;
}
