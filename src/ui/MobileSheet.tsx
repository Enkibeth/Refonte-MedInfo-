/**
 * Briques de l'en-tête mobile (< 640 px), partagées par le chat et les outils.
 *
 * Retour Hugo 2026-10 : sur téléphone, le chat « occupe tout l'écran » (une seule barre en
 * haut, menu ☰ en feuille) alors que les outils empilaient un bouton « Outils », un titre, un
 * paragraphe et la barre d'onglets du bas : l'outil lui-même n'avait plus qu'un petit cadre.
 * Les outils reprennent donc exactement la barre et la feuille du chat (src/ui/AppMobileHeader.tsx).
 *
 *   [☰]          [icône Titre]          [action ou vide]
 */
import { Children, Fragment, type ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { CountryCode } from '@/ai/chat/country';
import { CountryFlag } from '@/ui/chat/CountryFlag';
import { Icon, type IconName } from '@/ui/icons';
import { tokens } from '@/ui/tokens';

export const ICON_SLOT = 44;

/** Bouton d'icône 44 × 44 de la barre mobile (☰, ＋…). */
export function HeaderIconButton({ icon, label, onPress, expanded }: { icon: IconName; label: string; onPress: () => void; expanded?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-expanded={expanded}
      {...(Platform.OS === 'web' ? { title: label } : {})}
      style={({ pressed }: { pressed: boolean }) => [sheetStyles.iconSlot, sheetStyles.iconButton, pressed && sheetStyles.pressed]}
    >
      <Icon name={icon} size={22} color={tokens.colors.text} />
    </Pressable>
  );
}

/** Feuille en bas d'écran (fond assombri, poignée, défilement si le contenu dépasse). */
export function MobileSheet({
  visible,
  onClose,
  onDismiss,
  label,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  /** iOS natif : appelé une fois la feuille fermée (ouvrir une autre fenêtre ensuite). */
  onDismiss?: () => void;
  /** Nom accessible de la feuille. */
  label: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} onDismiss={onDismiss}>
      <Pressable style={sheetStyles.backdrop} onPress={onClose}>
        <Pressable
          role="dialog"
          aria-modal
          aria-label={label}
          style={[sheetStyles.sheet, { paddingBottom: tokens.space['2xl'] + insets.bottom }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={sheetStyles.grabber} />
          <ScrollView style={sheetStyles.scroll} contentContainerStyle={sheetStyles.scrollContent}>
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function MenuSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={sheetStyles.section}>
      <Text style={sheetStyles.sectionTitle}>{title}</Text>
      <View style={sheetStyles.sectionCard}>
        {/* Filet entre deux lignes (aligné sur le texte, comme les listes iOS). */}
        {Children.toArray(children).map((child, i) => (
          <Fragment key={i}>
            {i > 0 ? <View style={sheetStyles.separator} /> : null}
            {child}
          </Fragment>
        ))}
      </View>
    </View>
  );
}

export function MenuRow({
  icon,
  iconColor = tokens.colors.accentDeep,
  iconBackground,
  label,
  value,
  valueFlag,
  chevron,
  current,
  onPress,
}: {
  icon: IconName;
  iconColor?: string;
  /** Pastille teintée derrière l'icône (outils : featureTint). */
  iconBackground?: string;
  label: string;
  value?: string;
  valueFlag?: CountryCode | null;
  chevron?: boolean;
  /** Page actuellement ouverte (annoncée, mise en évidence). */
  current?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label} : ${value}` : label}
      aria-current={current ? 'page' : undefined}
      style={({ pressed }: { pressed: boolean }) => [sheetStyles.row, current && sheetStyles.rowCurrent, pressed && sheetStyles.rowPressed]}
    >
      {iconBackground ? (
        <View style={[sheetStyles.rowChip, { backgroundColor: iconBackground }]}>
          <Icon name={icon} size={17} color={iconColor} />
        </View>
      ) : (
        <Icon name={icon} size={19} color={iconColor} />
      )}
      <Text style={[sheetStyles.rowLabel, current && sheetStyles.rowLabelCurrent]} numberOfLines={1}>
        {label}
      </Text>
      {valueFlag ? <CountryFlag code={valueFlag} size={15} /> : null}
      {value ? <Text style={sheetStyles.rowValue} numberOfLines={1}>{value}</Text> : null}
      {chevron ? <Icon name="chevronRight" size={16} color={tokens.colors.textMuted} /> : null}
    </Pressable>
  );
}

export const sheetStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.space.xs,
    paddingBottom: tokens.space.xs,
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderColor: tokens.colors.border,
  },
  iconSlot: { width: ICON_SLOT, height: ICON_SLOT },
  iconButton: { alignItems: 'center', justifyContent: 'center', borderRadius: tokens.radius.pill },
  pressed: { opacity: 0.6 },
  title: {
    flexShrink: 1,
    minHeight: ICON_SLOT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: tokens.space.md,
  },
  titleText: {
    flexShrink: 1,
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.ui.fontSize + 1,
    lineHeight: tokens.type.ui.lineHeight,
    fontWeight: tokens.weight.semibold,
    color: tokens.colors.text,
  },

  backdrop: { flex: 1, backgroundColor: tokens.colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '88%',
    backgroundColor: tokens.colors.background,
    borderTopLeftRadius: tokens.radius.xl,
    borderTopRightRadius: tokens.radius.xl,
    paddingHorizontal: tokens.space.md,
    paddingTop: tokens.space.sm,
    ...tokens.elevation.lg,
  },
  scroll: { flexGrow: 0 },
  scrollContent: { gap: tokens.space.md },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: tokens.colors.borderStrong,
    marginBottom: tokens.space.sm,
  },
  section: { gap: tokens.space.xs },
  sectionTitle: {
    fontFamily: tokens.font.sans,
    ...tokens.type.caption,
    fontWeight: tokens.weight.semibold,
    color: tokens.colors.textMuted,
    paddingHorizontal: tokens.space.sm,
  },
  sectionCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    overflow: 'hidden',
  },
  row: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    paddingHorizontal: tokens.space.md,
  },
  rowChip: { width: 30, height: 30, borderRadius: tokens.radius.md, alignItems: 'center', justifyContent: 'center' },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: tokens.colors.border, marginLeft: tokens.space.md + 19 + tokens.space.md },
  rowCurrent: { backgroundColor: tokens.colors.accentSurface },
  rowPressed: { backgroundColor: tokens.colors.surfaceAlt },
  rowLabel: { flex: 1, fontFamily: tokens.font.sans, ...tokens.type.input, color: tokens.colors.text },
  rowLabelCurrent: { color: tokens.colors.accentDeep, fontWeight: tokens.weight.semibold },
  rowValue: { fontFamily: tokens.font.sans, ...tokens.type.body, color: tokens.colors.textMuted, maxWidth: 140 },
  // Masqué à l'écran, lu par les lecteurs d'écran.
  srOnly: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
});
