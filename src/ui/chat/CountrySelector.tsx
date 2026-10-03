/**
 * Sélecteur de PAYS en haut du chat (2026-07).
 *
 * Le pays choisi est envoyé dans le body de /api/chat (comme personalInfo) et
 * oriente les sources que l'assistant privilégie (agence du médicament, RCP,
 * recommandations). Pure ergonomie : aucune donnée de santé, jamais une barrière
 * de sécurité (l'autorisation reste serveur).
 */
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { COUNTRIES, getCountry, type CountryCode } from '@/ai/chat/country';
import { CountryFlag } from '@/ui/chat/CountryFlag';
import { Icon } from '@/ui/icons';
import { tokens } from '@/ui/tokens';
import { Touchable } from '@/ui/Touchable';
import { toolbarButtonStyles, toolbarContentColor } from '@/ui/toolbarButton';

export function CountrySelector({
  value,
  onChange,
  open: openProp,
  onOpenChange,
  hideTrigger = false,
}: {
  value: CountryCode | null;
  onChange: (code: CountryCode) => void;
  /** Ouverture pilotée par le parent (menu mobile du chat) ; sinon état interne. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Sans bouton déclencheur : seule la liste s'affiche, ouverte par le parent. */
  hideTrigger?: boolean;
}) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (next: boolean) => {
    setOpenState(next);
    onOpenChange?.(next);
  };
  const current = value ? getCountry(value) : undefined;

  return (
    <>
      {hideTrigger ? null : <Touchable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={current ? `Pays : ${current.name}` : 'Choisir le pays'}
        aria-expanded={open}
        style={toolbarButtonStyles.button}
      >
        {current ? (
          // Drapeau via CountryFlag : emoji natif partout, SVG inline sur Windows
          // (Segoe UI Emoji n'a pas les drapeaux — ils s'affichaient « FR » en lettres).
          <CountryFlag code={current.code} size={14} />
        ) : (
          <Icon name="globe" size={16} color={toolbarContentColor()} />
        )}
        <Text style={toolbarButtonStyles.label}>{current ? current.code : 'Pays'}</Text>
      </Touchable>}

      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.panel} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.panelTitle}>Pays d’exercice</Text>
            <Text style={styles.panelHint}>
              Oriente les sources que l’assistant privilégie (agence du médicament, RCP,
              recommandations).
            </Text>
            <ScrollView style={styles.list}>
              {COUNTRIES.map((c) => {
                const active = c.code === value;
                return (
                  <Touchable
                    key={c.code}
                    onPress={() => {
                      onChange(c.code);
                      setOpen(false);
                    }}
                    accessibilityRole="radio"
                    aria-checked={active}
                    style={[styles.item, active && styles.itemActive]}
                  >
                    <View style={styles.itemFlag}>
                      <CountryFlag code={c.code} size={18} />
                    </View>
                    <Text style={[styles.itemLabel, active && styles.itemLabelActive]}>{c.name}</Text>
                    {active ? <Icon name="check" size={16} color={tokens.colors.accentDeep} /> : <View />}
                  </Touchable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.space.lg,
  },
  panel: {
    width: 320,
    maxWidth: '100%',
    maxHeight: 460,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: tokens.space.md,
    ...tokens.elevation.lg,
  },
  panelTitle: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    fontWeight: tokens.weight.bold,
    paddingHorizontal: tokens.space.xs,
  },
  panelHint: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    lineHeight: 17,
    paddingHorizontal: tokens.space.xs,
    marginTop: 2,
    marginBottom: tokens.space.sm,
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
  itemFlag: { width: 28, alignItems: 'center' },
  itemLabel: {
    flex: 1,
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.medium,
  },
  itemLabelActive: { color: tokens.colors.accentDeep, fontWeight: tokens.weight.semibold },
});
