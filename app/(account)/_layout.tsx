import { Platform } from 'react-native';
import { Stack } from 'expo-router';

import { bannerStackHeader } from '@/ui/BannerStackHeader';
import { screenMainLayout } from '@/ui/landmarks';
import { PlainHeaderTitle } from '@/ui/PlainHeaderTitle';
import { SeoHead } from '@/ui/SeoHead';
import { SHELL_BREAKPOINT } from '@/ui/shell/AppShell';
import { useWindowWidth } from '@/ui/useWindowWidth';

export default function AccountLayout() {
  const width = useWindowWidth();
  // Sous le shell desktop (sidebar + fil d'Ariane), l'en-tête natif du Stack
  // ferait doublon ; on le garde sur mobile pour le retour arrière.
  const inShell = Platform.OS === 'web' && width >= SHELL_BREAKPOINT;
  return (
    <>
      {/* Pages privées : exclues des moteurs (refonte SEO 2026-07). */}
      <SeoHead title="Mon compte" path="/account" noindex />
      <Stack
        screenOptions={{
          title: 'Compte',
          headerShown: !inShell,
          // Le titre de l'écran (« Mon compte ») est le seul titre de niveau 1 de la page.
          headerTitle: PlainHeaderTitle,
          // Web : en-tête dans un repère `banner` (hors du <main> de l'écran).
          ...(Platform.OS === 'web' ? { header: bannerStackHeader as never } : null),
        }}
        screenLayout={screenMainLayout}
      />
    </>
  );
}
