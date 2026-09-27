import { Platform } from 'react-native';
import { Stack } from 'expo-router';

import { SHELL_BREAKPOINT } from '@/ui/shell/AppShell';
import { useWindowWidth } from '@/ui/useWindowWidth';

export default function BillingLayout() {
  const width = useWindowWidth();
  // Sous le shell desktop (sidebar + fil d'Ariane), l'en-tête natif ferait doublon.
  const inShell = Platform.OS === 'web' && width >= SHELL_BREAKPOINT;
  return <Stack screenOptions={{ title: 'Offres', headerShown: !inShell }} />;
}
