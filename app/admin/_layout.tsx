import { Stack } from 'expo-router';

import { screenMainLayout } from '@/ui/landmarks';
import { SeoHead } from '@/ui/SeoHead';

export default function AdminLayout() {
  return (
    <>
      {/* Panel admin : exclu des moteurs (refonte SEO 2026-07). */}
      <SeoHead title="Admin" path="/admin" noindex />
      <Stack screenOptions={{ headerShown: false }} screenLayout={screenMainLayout} />
    </>
  );
}
