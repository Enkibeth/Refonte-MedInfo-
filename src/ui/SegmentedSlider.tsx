/**
 * Curseur à crans (segmented slider) sans dépendance native.
 * Rendu « rail + pastille + crans » qui se lit comme un curseur, mais sur des valeurs
 * discrètes (idéal pour réflexion/détail). Accessible et tactile (chaque cran cliquable).
 */
import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { tokens } from '@/ui/tokens';

export interface SegmentedSliderOption<T extends string> {
  value: T;
  label: string;
}

export function SegmentedSlider<T extends string>({
  label,
  options,
  value,
  onChange,
  hint,
  disabled = false,
}: {
  label: string;
  options: SegmentedSliderOption<T>[];
  value: T;
  onChange: (value: T) => void;
  hint?: string;
  disabled?: boolean;
}) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const activeLabel = options[index]?.label ?? '';
  // Position de la pastille (0 → 1) au centre du cran courant.
  const fill = useMemo(
    () => (options.length <= 1 ? 0 : index / (options.length - 1)),
    [index, options.length],
  );

  return (
    <View style={[styles.container, disabled && styles.disabled]}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{activeLabel}</Text>
      </View>

      <View style={styles.track} accessibilityRole="adjustable">
        <View style={[styles.fill, { width: `${fill * 100}%` }]} />
        {options.map((o, i) => {
          const active = i === index;
          const passed = i <= index;
          return (
            <TouchableOpacity
              key={o.value}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${label} : ${o.label}`}
              disabled={disabled}
              style={styles.notchHit}
              onPress={() => onChange(o.value)}
            >
              <View
                style={[
                  styles.notch,
                  passed && styles.notchPassed,
                  active && styles.notchActive,
                ]}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.scaleLabels}>
        {options.map((o, i) => (
          <Text
            key={o.value}
            style={[styles.scaleLabel, i === index && styles.scaleLabelActive]}
            numberOfLines={1}
          >
            {o.label}
          </Text>
        ))}
      </View>

      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: tokens.space.sm },
  disabled: { opacity: 0.5 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.bold,
  },
  value: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.monoSm.fontSize,
    letterSpacing: tokens.type.monoSm.letterSpacing,
    textTransform: 'uppercase',
    fontWeight: tokens.weight.bold,
  },
  track: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: tokens.radius.none,
    backgroundColor: tokens.colors.surfacePure,
    borderWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
    paddingHorizontal: 4,
    position: 'relative',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: tokens.radius.none,
    backgroundColor: tokens.colors.accentSurfaceStrong,
  },
  notchHit: { padding: 6 },
  notch: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: tokens.border.hairline,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfacePure,
  },
  notchPassed: { backgroundColor: tokens.colors.accentStrong },
  notchActive: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: tokens.colors.accent,
    borderColor: tokens.colors.border,
  },
  scaleLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  scaleLabel: {
    flex: 1,
    fontFamily: tokens.font.mono,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.monoSm.fontSize,
    letterSpacing: tokens.type.monoSm.letterSpacing,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  scaleLabelActive: { color: tokens.colors.accentDeep, fontWeight: tokens.weight.bold },
  hint: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    lineHeight: 17,
  },
});
