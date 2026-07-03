import { Stack } from 'expo-router';

import { SeoHead } from '@/ui/SeoHead';

export default function AccountLayout() {
  return (
    <>
      {/* Pages privées : exclues des moteurs (refonte SEO 2026-07). */}
      <SeoHead title="Mon compte" path="/account" noindex />
      <Stack screenOptions={{ title: 'Compte' }} />
    </>
  );
}
