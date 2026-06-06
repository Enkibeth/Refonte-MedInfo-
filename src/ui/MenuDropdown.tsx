/**
 * MenuDropdown — menu de navigation déroulant, réutilisable (05_DESIGN).
 *
 * Bouton déclencheur compact (glyphe « menu ») ouvrant un popover modal : aller à l'accueil
 * ou basculer entre les fonctionnalités (Chat, Document, Audio, ECOS, compte). Style sobre,
 * tokens uniquement, accessible (rôles + labels). Aucune logique métier/médicale ici.
 */
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { tokens } from '@/ui/tokens';

export interface MenuEntry {
  key: string;
  label: string;
  emoji: string;
  href: string;
  description?: string;
}

export const DEFAULT_MENU: MenuEntry[] = [
  { key: 'home', label: 'Accueil', emoji: '🏠', href: '/', description: "Page d'accueil" },
  { key: 'chat', label: 'Chat', emoji: '💬', href: '/(chat)/chat', description: 'Questions santé sourcées' },
  { key: 'document', label: 'Document', emoji: '📄', href: '/(chat)/document', description: "Analyse d'un document" },
  { key: 'audio', label: 'Audio', emoji: '🎤', href: '/(chat)/audio', description: 'Compte rendu audio' },
  { key: 'ecos', label: 'ECOS', emoji: '🩺', href: '/(chat)/ecos', description: 'Station simulée' },
  { key: 'account', label: 'Mon compte', emoji: '👤', href: '/(account)/account', description: 'Profil et abonnement' },
];

function MenuGlyph() {
  return (
    <View style={styles.glyph} accessibilityElementsHidden>
      <View style={styles.glyphBar} />
      <View style={styles.glyphBar} />
      <View style={styles.glyphBar} />
    </View>
  );
}

function Chevron() {
  return <View style={styles.chevron} accessibilityElementsHidden />;
}

export function MenuDropdown({
  items = DEFAULT_MENU,
  label = 'Menu',
}: {
  items?: MenuEntry[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const go = (href: string) => {
    setOpen(false);
    // push (et non replace) : conserve la pile de navigation pour un « retour » naturel.
    router.push(href as never);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ouvrir le menu de navigation"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, pressed && styles.triggerPressed]}
      >
        <MenuGlyph />
        <Text style={styles.triggerLabel}>{label}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Fermer le menu">
          {/* Carte : un Pressable « avale » le tap pour ne pas refermer en cliquant dedans. */}
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Naviguer</Text>
            <View style={styles.list}>
              {items.map((item) => (
                <Pressable
                  key={item.key}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  onPress={() => go(item.href)}
                  style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
                >
                  <View style={styles.itemIcon}>
                    <Text style={styles.itemEmoji}>{item.emoji}</Text>
                  </View>
                  <View style={styles.itemBody}>
                    <Text style={styles.itemLabel}>{item.label}</Text>
                    {item.description ? <Text style={styles.itemDesc}>{item.description}</Text> : null}
                  </View>
                  <Chevron />
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // ── Trigger ──
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
  },
  triggerPressed: { backgroundColor: tokens.colors.surfaceAlt, borderColor: tokens.colors.borderStrong },
  triggerLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  glyph: { width: 16, height: 12, justifyContent: 'space-between' },
  glyphBar: { height: 2, borderRadius: 2, backgroundColor: tokens.colors.accent },

  // ── Backdrop + sheet ──
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(8, 27, 34, 0.38)',
    alignItems: 'center',
    paddingTop: tokens.space['3xl'],
    paddingHorizontal: tokens.space.lg,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    borderRadius: tokens.radius.xl,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingVertical: tokens.space.lg,
    paddingHorizontal: tokens.space.md,
    ...tokens.elevation.lg,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
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
    letterSpacing: 0.8,
    paddingHorizontal: tokens.space.sm,
    marginBottom: tokens.space.sm,
  },
  list: { gap: 2 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    paddingVertical: tokens.space.md,
    paddingHorizontal: tokens.space.sm,
    borderRadius: tokens.radius.md,
  },
  itemPressed: { backgroundColor: tokens.colors.accentSurface },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: tokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  itemEmoji: { fontSize: 20 },
  itemBody: { flex: 1, gap: 1 },
  itemLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.body.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  itemDesc: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
  },
  chevron: {
    width: 8,
    height: 8,
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: tokens.colors.textMuted,
    transform: [{ rotate: '-45deg' }],
  },
});
