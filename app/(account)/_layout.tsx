import { Platform, useWindowDimensions } from 'react-native';
import { Stack } from 'expo-router';

import { SeoHead } from '@/ui/SeoHead';
import { SHELL_BREAKPOINT } from '@/ui/shell/AppShell';

export default function AccountLayout() {
  const { width } = useWindowDimensions();
  // Sous le shell desktop (sidebar + fil d'Ariane), l'en-tête natif du Stack
  // ferait doublon ; on le garde sur mobile pour le retour arrière.
  const inShell = Platform.OS === 'web' && width >= SHELL_BREAKPOINT;
  return (
    <>
      {/* Pages privées : exclues des moteurs (refonte SEO 2026-07). */}
      <SeoHead title="Mon compte" path="/account" noindex />
      <Stack screenOptions={{ title: 'Compte', headerShown: !inShell }} />
    </>
  );
}
