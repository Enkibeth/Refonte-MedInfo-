import { Stack } from 'expo-router';

/**
 * Groupe marketing public (audit landing 2026-06) : À propos, Contact, Blog.
 * Pages accessibles SANS session (cf. inPublicGroup dans app/_layout.tsx) ;
 * chaque écran rend son propre <LandingHeader /> (pas de header natif).
 */
export default function MarketingLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
