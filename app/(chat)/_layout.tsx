import { Tabs } from 'expo-router';
import { Platform, Text, View, StyleSheet } from 'react-native';

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

  const hrefFor = (feature: AppFeatureId) =>
    isFeatureVisible(feature, persona, { isAdmin }) ? undefined : null;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: tabStyles.bar,
        tabBarActiveTintColor: tokens.colors.accent,
        tabBarInactiveTintColor: tokens.colors.textMuted,
        tabBarLabelStyle: tabStyles.label,
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

const tabStyles = StyleSheet.create({
  bar: {
    backgroundColor: tokens.colors.surface,
    borderTopColor: tokens.colors.border,
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 84 : 64,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 8,
    ...Platform.select({
      web: { boxShadow: '0 -1px 0 ' + tokens.colors.border } as any,
      default: {},
    }),
  },
  label: {
    fontFamily: tokens.font.sans,
    fontSize: 11,
    fontWeight: tokens.weight.semibold,
  },
  // Pastille d'arrière-plan sur l'outil actif → repère visuel net de la sélection.
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    height: 30,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  iconWrapActive: {
    backgroundColor: tokens.colors.accentSurface,
    borderColor: tokens.colors.accentSurfaceStrong,
  },
  emoji: { fontSize: 20, opacity: 0.6 },
  emojiActive: { opacity: 1 },
});
