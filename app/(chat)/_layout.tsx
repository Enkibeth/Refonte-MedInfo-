import { Tabs } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View, StyleSheet, type GestureResponderEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSession } from '@/auth/AuthProvider';
import { isAdminUserId } from '@/admin/index';
import { isFeatureVisible, type AppFeatureId } from '@/ai/routing/featureVisibility';
import { Icon, type IconName } from '@/ui/icons';
import { tokens } from '@/ui/tokens';

function TabIcon({ icon, focused }: { icon: IconName; focused: boolean }) {
  return (
    <View style={[tabStyles.iconChip, focused && tabStyles.iconChipActive]}>
      <Icon name={icon} size={20} color={focused ? tokens.colors.onAccent : tokens.colors.textMuted} />
    </View>
  );
}

/**
 * Bouton d'onglet personnalisé : la surbrillance de sélection entoure **tout** le
 * mode (icône + libellé) au lieu d'une pastille autour de la seule icône — la
 * sélection « n'entourait pas entièrement le mode ».
 */
type TabBarButtonProps = {
  children?: ReactNode;
  onPress?: (e: GestureResponderEvent) => void;
  onLongPress?: (e: GestureResponderEvent) => void;
  accessibilityState?: { selected?: boolean };
  accessibilityLabel?: string;
  testID?: string;
};

function TabBarButton({
  children,
  onPress,
  onLongPress,
  accessibilityState,
  accessibilityLabel,
  testID,
}: TabBarButtonProps) {
  const focused = accessibilityState?.selected ?? false;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="tab"
      accessibilityState={accessibilityState}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={tabStyles.button}
    >
      <View style={[tabStyles.pill, focused && tabStyles.pillActive]}>{children}</View>
    </Pressable>
  );
}

/**
 * Navigation adaptée au rôle (persona) — chaque rôle ne voit QUE ses outils
 * (cf src/ai/routing/featureVisibility.ts). Un onglet non autorisé est retiré de la
 * barre via `href: null` ; l'écran reste protégé par <RoleGate> en défense en profondeur.
 *  - Grand public : Chat + Document.
 *  - Étudiant     : Chat + ECOS + Partiel + Présentations.
 *  - Professionnel: Chat + Audio + Présentations.
 *  - Admin        : tout.
 */
export default function ChatLayout() {
  const { persona, user, session } = useSession();
  const isAdmin = user ? isAdminUserId(user.id) : false;
  // Visiteur non connecté (essai sans inscription) : seul l'onglet Chat est visible.
  const isGuest = !session;
  const insets = useSafeAreaInsets();

  const hrefFor = (feature: AppFeatureId) =>
    isFeatureVisible(feature, persona, { isAdmin, isGuest }) ? undefined : null;

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
        // Le type exact (BottomTabBarButtonProps) vient d'une dépendance transitive ;
        // on n'en consomme qu'un sous-ensemble stable (cf. TabBarButtonProps).
        tabBarButton: (props) => <TabBarButton {...(props as unknown as TabBarButtonProps)} />,
      }}
    >
      <Tabs.Screen
        name="chat"
        options={{ title: 'Chat', href: hrefFor('chat'), tabBarIcon: ({ focused }) => <TabIcon icon="messageCircle" focused={focused} /> }}
      />
      <Tabs.Screen
        name="document"
        options={{ title: 'Document', href: hrefFor('document'), tabBarIcon: ({ focused }) => <TabIcon icon="fileText" focused={focused} /> }}
      />
      <Tabs.Screen
        name="ecos"
        options={{ title: 'ECOS', href: hrefFor('ecos'), tabBarIcon: ({ focused }) => <TabIcon icon="stethoscope" focused={focused} /> }}
      />
      <Tabs.Screen
        name="partiel"
        options={{ title: 'Partiel', href: hrefFor('partiel'), tabBarIcon: ({ focused }) => <TabIcon icon="barChart" focused={focused} /> }}
      />
      <Tabs.Screen
        name="audio"
        options={{ title: 'Audio', href: hrefFor('audio'), tabBarIcon: ({ focused }) => <TabIcon icon="micVoice" focused={focused} /> }}
      />
      <Tabs.Screen
        name="presentation"
        options={{ title: 'Présentations', href: hrefFor('presentation'), tabBarIcon: ({ focused }) => <TabIcon icon="presentation" focused={focused} /> }}
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
    borderTopWidth: 1,
    paddingTop: tokens.space.sm,
    ...tokens.elevation.md,
  },
  item: { paddingTop: 2 },
  label: {
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.weight.semibold,
    marginTop: 2,
  },
  // Conteneur plein de l'onglet : centre le contenu et laisse respirer la pastille.
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.space.xs,
  },
  // Surbrillance qui entoure TOUT le mode (icône + libellé).
  pill: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    paddingTop: 4,
    paddingBottom: 3,
    paddingHorizontal: tokens.space.sm,
    borderRadius: tokens.radius.lg,
    ...tokens.motion.transitionWeb,
  },
  pillActive: {
    backgroundColor: tokens.colors.accentSurface,
  },
  // Pastille d'icône : remplie en accent quand l'onglet est actif (icône blanche),
  // discrète sinon. Donne un repère visuel net par onglet.
  iconChip: {
    width: 38,
    height: 28,
    borderRadius: tokens.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    ...tokens.motion.transitionWeb,
  },
  iconChipActive: {
    backgroundColor: tokens.colors.accent,
    ...tokens.elevation.sm,
  },
});
