/**
 * Menu déroulant de navigation entre outils (header) — alternative bien visible à
 * la barre d'onglets du bas. N'affiche QUE les outils du rôle courant
 * (cf featureVisibility.ts) + Mon compte / Accueil (+ Admin si admin).
 */
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, useSegments } from 'expo-router';

import { useSession } from '@/auth/AuthProvider';
import { isAdminUserId } from '@/admin/index';
import { visibleFeatures } from '@/ai/routing/featureVisibility';
import { Icon, type IconName } from '@/ui/icons';
import { tokens } from '@/ui/tokens';

interface MenuItem {
  key: string;
  label: string;
  icon: IconName;
  route: string;
}

export function ToolsMenu() {
  const router = useRouter();
  const segments = useSegments();
  const { persona, user, session } = useSession();
  const [open, setOpen] = useState(false);

  const isAdmin = user ? isAdminUserId(user.id) : false;
  // Visiteur non connecté (essai sans inscription) : seul le chat apparaît dans le menu.
  const isGuest = !session;
  const current = (segments as string[])[segments.length - 1];

  const tools: MenuItem[] = visibleFeatures(persona, { isAdmin, isGuest }).map((f) => ({
    key: f.id,
    label: f.label,
    icon: f.icon,
    route: f.route,
  }));

  const extras: MenuItem[] = isGuest
    ? [
        { key: 'home', label: 'Accueil', icon: 'home', route: '/' },
        { key: 'signin', label: 'Se connecter / Créer un compte', icon: 'userRound', route: '/(auth)/sign-in' },
      ]
    : [
        { key: 'account', label: 'Mon compte', icon: 'userRound', route: '/(account)/account' },
        { key: 'home', label: 'Accueil', icon: 'home', route: '/' },
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
        <Text style={styles.triggerIcon}>⋯</Text>
        <Text style={styles.triggerLabel}>Outils</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.panel} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.panelTitle}>Mes outils</Text>
            <ScrollView style={styles.list}>
              {tools.map((item) => {
                const active = item.key === current;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => go(item.route)}
                    accessibilityRole="button"
                    style={[styles.item, active && styles.itemActive]}
                  >
                    <View style={styles.itemIcon}>
                      <Icon name={item.icon} size={17} color={active ? tokens.colors.accentDeep : tokens.colors.textSubtle} />
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
  triggerIcon: { fontSize: 18, lineHeight: 18, color: tokens.colors.accentDeep, fontWeight: tokens.weight.bold },
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
    letterSpacing: 0.8,
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
  itemIcon: { width: 22, alignItems: 'center' },
  itemLabel: {
    flex: 1,
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.medium,
  },
  itemLabelActive: { color: tokens.colors.accentDeep, fontWeight: tokens.weight.semibold },
  itemDot: { color: tokens.colors.accent, fontSize: 20 },
  separator: { height: 1, backgroundColor: tokens.colors.border, marginVertical: tokens.space.xs },
});
