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
  const { persona, user, session, loading } = useSession();
  const isAdmin = user ? isAdminUserId(user.id) : false;
  // Visiteur non connecté (essai sans inscription) : seul le chat est accessible.
  // ⚠️ Ne jamais conclure « invité » pendant l'hydratation de session : un onglet
  // `href: null` est RETIRÉ du navigateur et un deep-link (ex. /dashboard au
  // rechargement) retomberait sur l'onglet initial avant que la session ne charge.
  const isGuest = !session && !loading;

  const hrefFor = (feature: AppFeatureId) =>
    isFeatureVisible(feature, persona, { isAdmin, isGuest }) ? undefined : null;

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      // Le type exact (BottomTabBarProps) vient d'une dépendance transitive ;
      // on n'en consomme qu'un sous-ensemble stable (cf. AppTabBarProps).
      tabBar={(props) => <AppTabBar {...(props as unknown as AppTabBarProps)} />}
    >
      {/* Vue d’ensemble (refonte shell 2026-07) : accueil de l’espace connecté.
          Cachée aux visiteurs (essai = chat seul) ; l'écran redirige aussi de lui-même. */}
      <Tabs.Screen
        name="dashboard"
        options={{ title: "Vue d’ensemble", href: isGuest ? null : undefined }}
      />
      <Tabs.Screen name="chat" options={{ title: 'Chat', href: hrefFor('chat') }} />
      <Tabs.Screen name="document" options={{ title: 'Document', href: hrefFor('document') }} />
      <Tabs.Screen name="ecos" options={{ title: 'ECOS', href: hrefFor('ecos') }} />
      <Tabs.Screen name="partiel" options={{ title: 'Classement', href: hrefFor('partiel') }} />
      <Tabs.Screen name="revision" options={{ title: 'Révisions', href: hrefFor('revision') }} />
      <Tabs.Screen name="audio" options={{ title: 'Audio', href: hrefFor('audio') }} />
      <Tabs.Screen name="presentation" options={{ title: 'Présentations', href: hrefFor('presentation') }} />
      <Tabs.Screen name="cv-builder" options={{ title: 'CV', href: hrefFor('cv-builder') }} />
      <Tabs.Screen name="article" options={{ title: 'Article', href: hrefFor('article') }} />
      <Tabs.Screen name="scores" options={{ title: 'Scores', href: hrefFor('scores') }} />
    </Tabs>
  );
}
