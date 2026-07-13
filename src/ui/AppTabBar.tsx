/**
 * Barre d'onglets du bas, adaptée au mobile (refonte lisibilité 2026-07).
 *
 * Problème d'origine : jusqu'à 6 onglets (8 en admin) entassés → icônes et
 * libellés illisibles sur téléphone. Solution : au plus TAB_BAR_MAX entrées —
 * les outils prioritaires du rôle + un bouton « Outils » qui ouvre un panneau
 * en bas d'écran listant TOUS les outils du rôle (cartes icône + description).
 *
 * La répartition barre / panneau vient du module pur
 * src/ai/routing/featureVisibility.ts (`tabBarFeatures`) — la matrice de
 * visibilité par rôle reste inchangée et le serveur reste la vraie barrière.
 */
import { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSession } from '@/auth/AuthProvider';
import { isAdminUserId } from '@/admin/index';
import {
  tabBarFeatures,
  visibleFeatures,
  type AppFeatureMeta,
} from '@/ai/routing/featureVisibility';
import { featureTint } from '@/ui/featureChips';
import { Icon, type IconName } from '@/ui/icons';
import { SHELL_BREAKPOINT } from '@/ui/shell/AppShell';
import { tokens } from '@/ui/tokens';
import { useReducedMotion } from '@/ui/useReducedMotion';

/**
 * Sous-ensemble stable des props du tab bar de React Navigation (le type exact,
 * BottomTabBarProps, vient d'une dépendance transitive — même convention que
 * l'ancien TabBarButton du layout).
 */
interface TabRoute {
  key: string;
  name: string;
}
export interface AppTabBarProps {
  state: { index: number; routes: TabRoute[] };
  navigation: {
    navigate: (name: string) => void;
    emit: (event: { type: 'tabPress'; target?: string; canPreventDefault: boolean }) => {
      defaultPrevented: boolean;
    };
  };
}

interface ExtraLink {
  key: string;
  label: string;
  icon: IconName;
  route: string;
}

export function AppTabBar({ state, navigation }: AppTabBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const { persona, user, session } = useSession();
  const [sheetOpen, setSheetOpen] = useState(false);

  const isAdmin = user ? isAdminUserId(user.id) : false;
  const isGuest = !session;
  const ctx = { isAdmin, isGuest };

  // L’onglet « Accueil » (Vue d’ensemble) occupe un slot pour les comptes connectés.
  const showHome = !isGuest;
  const { bar, overflow } = tabBarFeatures(persona, ctx, { reservedSlots: showHome ? 1 : 0 });
  const allTools = visibleFeatures(persona, ctx);
  const activeName = state.routes[state.index]?.name;

  // Desktop web : la sidebar du shell (src/ui/shell/AppShell.tsx) porte la navigation.
  if (Platform.OS === 'web' && width >= SHELL_BREAKPOINT) return null;

  // Un seul outil visible (visiteur non connecté) : une barre à onglet unique
  // n'apporte rien — on rend l'espace à l'écran de chat.
  if (!showHome && bar.length <= 1) return null;

  const goToRoute = (name: string) => {
    setSheetOpen(false);
    const route = state.routes.find((r) => r.name === name);
    if (!route) return;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (activeName !== route.name && !event.defaultPrevented) navigation.navigate(route.name);
  };

  const goToFeature = (feature: AppFeatureMeta) => goToRoute(feature.id);

  const extras: ExtraLink[] = isGuest
    ? [
        { key: 'home', label: 'Accueil', icon: 'home', route: '/' },
        { key: 'signin', label: 'Se connecter / Créer un compte', icon: 'userRound', route: '/(auth)/sign-in' },
      ]
    : [
        { key: 'account', label: 'Mon compte', icon: 'userRound', route: '/(account)/account' },
        { key: 'home', label: 'Accueil du site', icon: 'globe', route: '/' },
      ];
  if (isAdmin) extras.push({ key: 'admin', label: 'Panel admin', icon: 'settings', route: '/(admin)' });

  const goToExtra = (route: string) => {
    setSheetOpen(false);
    router.push(route as never);
  };

  const bottomInset = Math.max(insets.bottom, tokens.space.sm);

  const homeActive = activeName === 'dashboard';

  return (
    <View style={[styles.bar, { paddingBottom: bottomInset }]}>
      {showHome ? (
        <Pressable
          onPress={() => goToRoute('dashboard')}
          accessibilityRole="tab"
          accessibilityState={{ selected: homeActive }}
          accessibilityLabel="Vue d’ensemble"
          style={styles.tab}
        >
          <View style={[styles.tabPill, homeActive && styles.tabPillActive]}>
            <Icon
              name="home"
              size={22}
              color={homeActive ? tokens.colors.onAccent : tokens.colors.textMuted}
            />
          </View>
          <Text style={[styles.tabLabel, homeActive && styles.tabLabelActive]} numberOfLines={1}>
            Accueil
          </Text>
        </Pressable>
      ) : null}
      {bar.map((feature) => {
        const focused = activeName === feature.id;
        return (
          <Pressable
            key={feature.id}
            onPress={() => goToFeature(feature)}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={feature.label}
            style={styles.tab}
          >
            <View style={[styles.tabPill, focused && styles.tabPillActive]}>
              <Icon
                name={feature.icon}
                size={22}
                color={focused ? tokens.colors.onAccent : tokens.colors.textMuted}
              />
            </View>
            <Text style={[styles.tabLabel, focused && styles.tabLabelActive]} numberOfLines={1}>
              {feature.label}
            </Text>
          </Pressable>
        );
      })}

      {overflow.length > 0 ? (
        <Pressable
          onPress={() => setSheetOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Ouvrir tous les outils"
          style={styles.tab}
        >
          <View style={[styles.tabPill, sheetOpen && styles.tabPillActive]}>
            <Icon
              name="layoutGrid"
              size={22}
              color={sheetOpen ? tokens.colors.onAccent : tokens.colors.textMuted}
            />
          </View>
          <Text style={[styles.tabLabel, sheetOpen && styles.tabLabelActive]} numberOfLines={1}>
            Outils
          </Text>
        </Pressable>
      ) : null}

      <Modal
        visible={sheetOpen}
        transparent
        animationType={reducedMotion ? 'fade' : 'slide'}
        onRequestClose={() => setSheetOpen(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setSheetOpen(false)}
          accessibilityLabel="Fermer le panneau des outils"
        >
          <Pressable
            style={[styles.sheet, { paddingBottom: bottomInset + tokens.space.lg }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Mes outils</Text>
            <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetContent}>
              <View style={styles.grid}>
                {allTools.map((feature) => {
                  const active = activeName === feature.id;
                  const tint = featureTint(feature.id);
                  return (
                    <Pressable
                      key={feature.id}
                      onPress={() => goToFeature(feature)}
                      accessibilityRole="button"
                      accessibilityLabel={feature.label}
                      style={[styles.card, active && styles.cardActive]}
                    >
                      <View
                        style={[
                          styles.cardIcon,
                          { backgroundColor: tint.bg },
                          active && styles.cardIconActive,
                        ]}
                      >
                        <Icon
                          name={feature.icon}
                          size={20}
                          color={active ? tokens.colors.onAccent : tint.fg}
                        />
                      </View>
                      <Text style={[styles.cardLabel, active && styles.cardLabelActive]} numberOfLines={1}>
                        {feature.label}
                      </Text>
                      <Text style={styles.cardDescription} numberOfLines={2}>
                        {feature.description}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.separator} />
              {extras.map((item) => (
                <Pressable
                  key={item.key}
                  onPress={() => goToExtra(item.route)}
                  accessibilityRole="button"
                  style={styles.extraRow}
                >
                  <View style={styles.extraIcon}>
                    <Icon name={item.icon} size={17} color={tokens.colors.textSubtle} />
                  </View>
                  <Text style={styles.extraLabel}>{item.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.surface,
    borderTopColor: tokens.colors.border,
    borderTopWidth: 1,
    paddingTop: tokens.space.sm,
    paddingHorizontal: tokens.space.xs,
    ...tokens.elevation.md,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 2,
    minHeight: 54,
  },
  tabPill: {
    width: 52,
    height: 30,
    borderRadius: tokens.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    ...tokens.motion.transitionWeb,
  },
  tabPillActive: {
    backgroundColor: tokens.colors.accent,
    ...tokens.elevation.sm,
  },
  tabLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.micro.fontSize,
    lineHeight: tokens.type.micro.lineHeight,
    fontWeight: tokens.weight.semibold,
  },
  tabLabelActive: {
    color: tokens.colors.accentDeep,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 30, 78, 0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: tokens.colors.surface,
    borderTopLeftRadius: tokens.radius.xl,
    borderTopRightRadius: tokens.radius.xl,
    paddingTop: tokens.space.sm,
    paddingHorizontal: tokens.space.lg,
    maxHeight: '78%',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    ...tokens.elevation.lg,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.borderStrong,
    marginBottom: tokens.space.md,
  },
  sheetTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: tokens.tracking.caps,
    marginBottom: tokens.space.md,
  },
  sheetScroll: { flexGrow: 0 },
  sheetContent: { paddingBottom: tokens.space.sm },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space.sm,
  },
  card: {
    flexBasis: '48%',
    flexGrow: 1,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: tokens.space.md,
    gap: 4,
    ...tokens.motion.transitionWeb,
  },
  cardActive: {
    borderColor: tokens.colors.accent,
    backgroundColor: tokens.colors.accentSurface,
  },
  cardIcon: {
    width: 34,
    height: 34,
    borderRadius: tokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.accentSurface,
    marginBottom: 2,
  },
  cardIconActive: {
    backgroundColor: tokens.colors.accent,
  },
  cardLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  cardLabelActive: {
    color: tokens.colors.accentDeep,
  },
  cardDescription: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    lineHeight: tokens.type.caption.lineHeight,
  },
  separator: {
    height: 1,
    backgroundColor: tokens.colors.border,
    marginVertical: tokens.space.md,
  },
  extraRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    paddingVertical: tokens.space.sm + 2,
    paddingHorizontal: tokens.space.xs,
    borderRadius: tokens.radius.md,
  },
  extraIcon: { width: 22, alignItems: 'center' },
  extraLabel: {
    flex: 1,
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.medium,
  },
});
