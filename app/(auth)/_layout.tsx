import { Stack } from 'expo-router';

import { SeoHead } from '@/ui/SeoHead';

export default function AuthLayout() {
  return (
    <>
      {/* Écrans d'authentification : exclus des moteurs (refonte SEO 2026-07). */}
      <SeoHead title="Connexion" path="/sign-in" noindex />
      <Stack screenOptions={{ title: 'Authentification' }} />
    </>
  );
}
