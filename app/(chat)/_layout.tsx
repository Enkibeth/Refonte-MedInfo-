import { Tabs } from 'expo-router';

import { useSession } from '@/auth/AuthProvider';
import { isAdminUserId } from '@/admin/index';
import { isFeatureVisible, type AppFeatureId } from '@/ai/routing/featureVisibility';
import { AppTabBar, type AppTabBarProps } from '@/ui/AppTabBar';

/**
 * Navigation adaptée au rôle (persona) — chaque rôle ne voit QUE ses outils
 * (cf src/ai/routing/featureVisibility.ts). Un onglet non autorisé est retiré de la
 * navigation via `href: null` ; l'écran reste protégé par <RoleGate> en défense en
 * profondeur.
 *
 * Refonte lisibilité mobile 2026-07 : la barre du bas est un composant custom
 * (src/ui/AppTabBar.tsx) limité à TAB_BAR_MAX entrées — outils prioritaires du rôle
 * + bouton « Outils » ouvrant le panneau complet. Fini les 6-8 onglets écrasés.
 */
export default function ChatLayout() {
  const { persona, user, session } = useSession();
  const isAdmin = user ? isAdminUserId(user.id) : false;
  // Visiteur non connecté (essai sans inscription) : seul le chat est accessible.
  const isGuest = !session;

  const hrefFor = (feature: AppFeatureId) =>
    isFeatureVisible(feature, persona, { isAdmin, isGuest }) ? undefined : null;

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      // Le type exact (BottomTabBarProps) vient d'une dépendance transitive ;
      // on n'en consomme qu'un sous-ensemble stable (cf. AppTabBarProps).
      tabBar={(props) => <AppTabBar {...(props as unknown as AppTabBarProps)} />}
    >
      <Tabs.Screen name="chat" options={{ title: 'Chat', href: hrefFor('chat') }} />
      <Tabs.Screen name="document" options={{ title: 'Document', href: hrefFor('document') }} />
      <Tabs.Screen name="ecos" options={{ title: 'ECOS', href: hrefFor('ecos') }} />
      <Tabs.Screen name="partiel" options={{ title: 'Classement', href: hrefFor('partiel') }} />
      <Tabs.Screen name="revision" options={{ title: 'Révisions', href: hrefFor('revision') }} />
      <Tabs.Screen name="audio" options={{ title: 'Audio', href: hrefFor('audio') }} />
      <Tabs.Screen name="presentation" options={{ title: 'Présentations', href: hrefFor('presentation') }} />
      <Tabs.Screen name="cv-builder" options={{ title: 'CV', href: hrefFor('cv-builder') }} />
    </Tabs>
  );
}
