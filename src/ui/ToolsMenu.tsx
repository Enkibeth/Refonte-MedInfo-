/**
 * Menu déroulant de navigation entre outils (header) — alternative bien visible à
 * la barre d'onglets du bas. N'affiche QUE les outils du rôle courant
 * (cf featureVisibility.ts) + Mon compte / Accueil (+ Admin si admin).
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
import { useRouter, useSegments } from 'expo-router';

import { useSession } from '@/auth/AuthProvider';
import { isAdminUserId } from '@/admin/index';
import { visibleFeatures, type AppFeatureId } from '@/ai/routing/featureVisibility';
import { featureTint } from '@/ui/featureChips';
import { Icon, type IconName } from '@/ui/icons';
import { SHELL_BREAKPOINT } from '@/ui/shell/AppShell';
import { tokens } from '@/ui/tokens';

interface MenuItem {
  key: string;
  label: string;
  icon: IconName;
  route: string;
  /** Outil du registre → pastille teintée (refonte shell 2026-07). */
  featureId?: AppFeatureId;
}

export function ToolsMenu() {
  const router = useRouter();
  const segments = useSegments();
  const { width } = useWindowDimensions();
  const { persona, user, session } = useSession();
  const [open, setOpen] = useState(false);

  const isAdmin = user ? isAdminUserId(user.id) : false;
  // Visiteur non connecté (essai sans inscription) : seul le chat apparaît dans le menu.
  const isGuest = !session;
  const current = (segments as string[])[segments.length - 1];

  // Sous le shell desktop (sidebar, src/ui/shell/AppShell.tsx), ce menu ferait
  // doublon avec la navigation latérale — il reste pour les invités, sans shell.
  if (Platform.OS === 'web' && width >= SHELL_BREAKPOINT && session) return null;

  const tools: MenuItem[] = visibleFeatures(persona, { isAdmin, isGuest }).map((f) => ({
    key: f.id,
    label: f.label,
    icon: f.icon,
    route: f.route,
    featureId: f.id,
  }));

  const extras: MenuItem[] = isGuest
    ? [
        { key: 'home', label: 'Accueil', icon: 'home', route: '/' },
        { key: 'signin', label: 'Se connecter / Créer un compte', icon: 'userRound', route: '/(auth)/sign-in' },
      ]
    : [
        { key: 'dashboard', label: "Vue d’ensemble", icon: 'home', route: '/(chat)/dashboard' },
        { key: 'account', label: 'Mon compte', icon: 'userRound', route: '/(account)/account' },
        // Ressources publiques : le blog n'était atteignable qu'en repassant par la
        // landing une fois connecté (retour signalé par Hugo).
        { key: 'blog', label: 'Blog santé', icon: 'bookOpen', route: '/(marketing)/blog' },
        { key: 'pricing', label: 'Tarifs', icon: 'scale', route: '/(billing)/pricing' },
      ];
  if (isAdmin) extras.push({ key: 'admin', label: 'Panel admin', icon: 'settings', route: '/(admin)' });

  const go = (route: string) => {
    setOpen(false);
    router.push(route as never);
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Ouvrir le menu des outils"
        style={styles.trigger}
      >
        <Icon name="layoutGrid" size={14} color={tokens.colors.accentDeep} />
        <Text style={styles.triggerLabel}>Outils</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.panel} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.panelTitle}>Mes outils</Text>
            <ScrollView style={styles.list}>
              {tools.map((item) => {
                const active = item.key === current;
                const tint = item.featureId ? featureTint(item.featureId) : null;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => go(item.route)}
                    accessibilityRole="button"
                    style={[styles.item, active && styles.itemActive]}
                  >
                    <View style={[styles.itemIcon, tint && { backgroundColor: tint.bg }]}>
                      <Icon
                        name={item.icon}
                        size={15}
                        color={active ? tokens.colors.accentDeep : (tint?.fg ?? tokens.colors.textSubtle)}
                      />
                    </View>
                    <Text style={[styles.itemLabel, active && styles.itemLabelActive]}>{item.label}</Text>
                    {active ? <Text style={styles.itemDot}>•</Text> : null}
                  </Pressable>
                );
              })}
              <View style={styles.separator} />
              {extras.map((item) => (
                <Pressable
                  key={item.key}
                  onPress={() => go(item.route)}
                  accessibilityRole="button"
                  style={styles.item}
                >
                  <View style={styles.itemIcon}>
                    <Icon name={item.icon} size={17} color={tokens.colors.textSubtle} />
                  </View>
                  <Text style={styles.itemLabel}>{item.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
    backgroundColor: tokens.colors.accentSurface,
    borderWidth: 1,
    borderColor: tokens.colors.accentSurfaceStrong,
  },
  triggerLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.32)',
    alignItems: 'flex-end',
    paddingTop: 64,
    paddingHorizontal: tokens.space.md,
  },
  panel: {
    width: 260,
    maxHeight: 460,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: tokens.space.sm,
    ...tokens.elevation.md,
  },
  panelTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: tokens.tracking.caps,
    paddingHorizontal: tokens.space.sm,
    paddingVertical: tokens.space.xs,
  },
  list: { flexGrow: 0 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    paddingHorizontal: tokens.space.sm,
    paddingVertical: tokens.space.sm + 2,
    borderRadius: tokens.radius.md,
  },
  itemActive: { backgroundColor: tokens.colors.accentSurface },
  itemIcon: {
    width: 26,
    height: 26,
    borderRadius: tokens.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemLabel: {
    flex: 1,
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.medium,
  },
  itemLabelActive: { color: tokens.colors.accentDeep, fontWeight: tokens.weight.semibold },
  itemDot: { color: tokens.colors.accent, fontSize: tokens.type.h3.fontSize },
  separator: { height: 1, backgroundColor: tokens.colors.border, marginVertical: tokens.space.xs },
});
