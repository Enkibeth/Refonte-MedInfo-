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
import { Icon } from '@/ui/icons';
import { tokens } from '@/ui/tokens';

export function CountrySelector({
  value,
  onChange,
}: {
  value: CountryCode | null;
  onChange: (code: CountryCode) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = value ? getCountry(value) : undefined;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={current ? `Pays : ${current.name}` : 'Choisir le pays'}
        style={styles.trigger}
      >
        {current ? (
          <Text style={styles.triggerFlag}>{current.flag}</Text>
        ) : (
          <Icon name="globe" size={14} color={tokens.colors.accentDeep} />
        )}
        <Text style={styles.triggerLabel}>{current ? current.code : 'Pays'}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
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
                  <Pressable
                    key={c.code}
                    onPress={() => {
                      onChange(c.code);
                      setOpen(false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[styles.item, active && styles.itemActive]}
                  >
                    <Text style={styles.itemFlag}>{c.flag}</Text>
                    <Text style={[styles.itemLabel, active && styles.itemLabelActive]}>{c.name}</Text>
                    {active ? <Icon name="check" size={16} color={tokens.colors.accentDeep} /> : <View />}
                  </Pressable>
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
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.space.sm + 2,
    paddingVertical: tokens.space.xs + 2,
    backgroundColor: tokens.colors.accentSurface,
    borderWidth: 1,
    borderColor: tokens.colors.accentSurfaceStrong,
  },
  triggerFlag: { fontSize: 14 },
  triggerLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
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
  itemFlag: { fontSize: 18 },
  itemLabel: {
    flex: 1,
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.medium,
  },
  itemLabelActive: { color: tokens.colors.accentDeep, fontWeight: tokens.weight.semibold },
});
