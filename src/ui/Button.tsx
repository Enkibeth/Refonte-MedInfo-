import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { tokens } from './tokens';

/**
 * Bouton MedInfo — primitive unique pour tous les écrans (05_DESIGN §4).
 * Variantes : primary (CTA petrol), secondary (contour), ghost (texte), danger.
 * États gérés : pressed (translation/opacité sobre), disabled, loading.
 */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  disabled = false,
  loading = false,
  fullWidth = true,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const isInactive = disabled || loading;
  const v = variantStyles[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isInactive, busy: loading }}
      disabled={isInactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' ? styles.lg : styles.md,
        v.container,
        fullWidth && styles.fullWidth,
        pressed && !isInactive && styles.pressed,
        isInactive && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'danger' ? tokens.colors.onAccent : tokens.colors.accent}
        />
      ) : null}
      <Text style={[styles.label, size === 'lg' ? styles.labelLg : styles.labelMd, v.label]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.space.sm,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  fullWidth: { alignSelf: 'stretch' },
  md: { minHeight: 44, paddingHorizontal: tokens.space.lg },
  lg: { minHeight: 52, paddingHorizontal: tokens.space.xl },
  pressed: { opacity: 0.92, transform: [{ translateY: 1 }] },
  disabled: { opacity: 0.5 },
  label: { fontFamily: tokens.font.sans, fontWeight: tokens.weight.semibold },
  labelMd: { fontSize: tokens.type.label.fontSize },
  labelLg: { fontSize: tokens.type.bodyLg.fontSize },
});

const variantStyles: Record<Variant, { container: ViewStyle; label: { color: string } }> = {
  primary: {
    container: { backgroundColor: tokens.colors.accent, ...tokens.elevation.sm },
    label: { color: tokens.colors.onAccent },
  },
  secondary: {
    container: { backgroundColor: tokens.colors.surface, borderColor: tokens.colors.borderStrong },
    label: { color: tokens.colors.accentDeep },
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    label: { color: tokens.colors.accent },
  },
  danger: {
    container: { backgroundColor: tokens.colors.danger },
    label: { color: tokens.colors.onAccent },
  },
};

/** Espace réservé exporté pour composer des rangées de boutons cohérentes. */
export function ButtonRow({ children }: { children: React.ReactNode }) {
  return <View style={rowStyles.row}>{children}</View>;
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.md },
});
