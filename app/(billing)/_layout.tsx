import { Platform, useWindowDimensions } from 'react-native';
import { Stack } from 'expo-router';

import { SHELL_BREAKPOINT } from '@/ui/shell/AppShell';

export default function BillingLayout() {
  const { width } = useWindowDimensions();
  // Sous le shell desktop (sidebar + fil d'Ariane), l'en-tête natif ferait doublon.
  const inShell = Platform.OS === 'web' && width >= SHELL_BREAKPOINT;
  return <Stack screenOptions={{ title: 'Offres', headerShown: !inShell }} />;
}
