import { Stack } from 'expo-router';
import { Platform } from 'react-native';

import { screenMainLayout } from '@/ui/landmarks';
import { SeoHead } from '@/ui/SeoHead';

export default function AuthLayout() {
  return (
    <>
      {/* Écrans d'authentification : exclus des moteurs (refonte SEO 2026-07). */}
      <SeoHead title="Connexion" path="/sign-in" noindex />
      {/* Web : pas de barre grise « Authentification » — l'écran porte déjà le logo et le
          lien « Retour à l'accueil ». Le natif garde l'en-tête de pile (retour). */}
      <Stack
        screenOptions={{ title: 'Authentification', headerShown: Platform.OS !== 'web' }}
        screenLayout={screenMainLayout}
      />
    </>
  );
}
