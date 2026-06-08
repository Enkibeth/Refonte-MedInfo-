import { Tabs } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSession } from '@/auth/AuthProvider';
import { isAdminUserId } from '@/admin/index';
import { isFeatureVisible, type AppFeatureId } from '@/ai/routing/featureVisibility';
import { tokens } from '@/ui/tokens';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <View style={[tabStyles.iconWrap, focused && tabStyles.iconWrapActive]}>
      <Text style={[tabStyles.emoji, focused && tabStyles.emojiActive]}>{emoji}</Text>
    </View>
  );
}

/**
 * Navigation adaptée au rôle (persona) — chaque rôle ne voit QUE ses outils
 * (cf src/ai/routing/featureVisibility.ts). Un onglet non autorisé est retiré de la
 * barre via `href: null` ; l'écran reste protégé par <RoleGate> en défense en profondeur.
 *  - Grand public : Chat + Document.
 *  - Étudiant     : Chat + ECOS + Partiel.
 *  - Professionnel: Chat + Audio.
 *  - Admin        : tout.
 */
export default function ChatLayout() {
  const { persona, user } = useSession();
  const isAdmin = user ? isAdminUserId(user.id) : false;
  const insets = useSafeAreaInsets();

  const hrefFor = (feature: AppFeatureId) =>
    isFeatureVisible(feature, persona, { isAdmin }) ? undefined : null;

  // Hauteur de la barre = contenu (icône + label) + marge de sécurité système
  // (encoche / home indicator / barre Safari). Sans cela, les libellés étaient coupés.
  const bottomInset = Math.max(insets.bottom, tokens.space.sm);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: [
          tabStyles.bar,
          { height: TAB_CONTENT_HEIGHT + bottomInset, paddingBottom: bottomInset },
        ],
        tabBarItemStyle: tabStyles.item,
        tabBarActiveTintColor: tokens.colors.accent,
        tabBarInactiveTintColor: tokens.colors.textMuted,
        tabBarLabelStyle: tabStyles.label,
        tabBarActiveBackgroundColor: 'transparent',
      }}
    >
      <Tabs.Screen
        name="chat"
        options={{ title: 'Chat', href: hrefFor('chat'), tabBarIcon: ({ focused }) => <TabIcon emoji="💬" focused={focused} /> }}
      />
      <Tabs.Screen
        name="document"
        options={{ title: 'Document', href: hrefFor('document'), tabBarIcon: ({ focused }) => <TabIcon emoji="📄" focused={focused} /> }}
      />
      <Tabs.Screen
        name="ecos"
        options={{ title: 'ECOS', href: hrefFor('ecos'), tabBarIcon: ({ focused }) => <TabIcon emoji="🩺" focused={focused} /> }}
      />
      <Tabs.Screen
        name="partiel"
        options={{ title: 'Partiel', href: hrefFor('partiel'), tabBarIcon: ({ focused }) => <TabIcon emoji="📈" focused={focused} /> }}
      />
      <Tabs.Screen
        name="audio"
        options={{ title: 'Audio', href: hrefFor('audio'), tabBarIcon: ({ focused }) => <TabIcon emoji="🎤" focused={focused} /> }}
      />
    </Tabs>
  );
}

// Hauteur du contenu de la barre (icône + label), hors marge système.
const TAB_CONTENT_HEIGHT = 58;

const tabStyles = StyleSheet.create({
  bar: {
    backgroundColor: tokens.colors.surface,
    borderTopColor: tokens.colors.border,
    borderTopWidth: tokens.border.bold,
    paddingTop: tokens.space.sm,
  },
  item: { paddingTop: 2 },
  label: {
    fontFamily: tokens.font.mono,
    fontSize: 10,
    fontWeight: tokens.weight.semibold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  // Bloc d'arrière-plan sur l'outil actif → repère net, à angle vif.
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 52,
    height: 30,
    borderRadius: tokens.radius.none,
    borderWidth: tokens.border.bold,
    borderColor: 'transparent',
    ...tokens.motion.transitionWeb,
  },
  // Sélection : aplat teinté plein + contour encre franc.
  iconWrapActive: {
    backgroundColor: tokens.colors.accentSurfaceStrong,
    borderColor: tokens.colors.border,
  },
  emoji: { fontSize: 20, opacity: 0.5 },
  emojiActive: { opacity: 1 },
});
