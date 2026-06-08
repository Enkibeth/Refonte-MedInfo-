import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { tokens } from './tokens';

/**
 * Bouton MedInfo — primitive unique (refonte « brutalisme structuré »).
 * Bloc à angle vif, bordure encre épaisse, ombre DURE décalée au repos ; au survol
 * il se soulève (-1 px) avec une ombre plus marquée, à l'appui il s'enfonce
 * (translate +3 px, ombre supprimée) comme une vraie touche.
 * Variantes : primary, secondary, ghost, danger, inverse, outlineLight.
 */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'inverse' | 'outlineLight';
type Size = 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const hardShadow = (offset: number, color: string) =>
  Platform.select({ web: { boxShadow: `${offset}px ${offset}px 0 0 ${color}` }, default: {} }) as ViewStyle;

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  disabled = false,
  loading = false,
  fullWidth = true,
  leftIcon,
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
      style={({ pressed, hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }) => [
        styles.base,
        size === 'lg' ? styles.lg : styles.md,
        v.container,
        fullWidth && styles.fullWidth,
        hovered && !isInactive && v.hover,
        focused && !isInactive && styles.focusRing,
        pressed && !isInactive && styles.pressed,
        isInactive && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={
            variant === 'inverse' || variant === 'secondary' || variant === 'ghost'
              ? tokens.colors.accent
              : tokens.colors.onAccent
          }
        />
      ) : leftIcon ? (
        <View style={styles.icon}>{leftIcon}</View>
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
    borderRadius: tokens.radius.none,
    borderWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
    ...tokens.motion.transitionWeb,
  },
  fullWidth: { alignSelf: 'stretch' },
  md: { minHeight: tokens.size.controlMd, paddingHorizontal: tokens.space.lg },
  lg: { minHeight: tokens.size.controlLg, paddingHorizontal: tokens.space.xl },
  // Appui : la touche s'enfonce dans la page (vient se coller à son ombre).
  pressed: {
    transform: [{ translateX: 3 }, { translateY: 3 }],
    ...(Platform.select({ web: { boxShadow: '0 0 0 0 transparent' }, default: {} }) as ViewStyle),
  },
  focusRing: tokens.focus.ring,
  disabled: { opacity: 0.45 },
  icon: { alignItems: 'center', justifyContent: 'center' },
  label: {
    fontFamily: tokens.font.sans,
    fontWeight: tokens.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  labelMd: { fontSize: tokens.type.label.fontSize },
  labelLg: { fontSize: tokens.type.label.fontSize },
});

const variantStyles: Record<Variant, { container: ViewStyle; hover: ViewStyle; label: { color: string } }> = {
  primary: {
    container: { backgroundColor: tokens.colors.accent, ...hardShadow(4, tokens.colors.ink) },
    hover: { backgroundColor: tokens.colors.accentStrong, transform: [{ translateX: -1 }, { translateY: -1 }], ...hardShadow(6, tokens.colors.ink) },
    label: { color: tokens.colors.onAccent },
  },
  secondary: {
    container: { backgroundColor: tokens.colors.surfacePure, ...hardShadow(4, tokens.colors.ink) },
    hover: { backgroundColor: tokens.colors.surface, transform: [{ translateX: -1 }, { translateY: -1 }], ...hardShadow(6, tokens.colors.ink) },
    label: { color: tokens.colors.text },
  },
  ghost: {
    container: { backgroundColor: 'transparent', borderColor: 'transparent' },
    hover: { backgroundColor: tokens.colors.accentSurface },
    label: { color: tokens.colors.accent },
  },
  danger: {
    container: { backgroundColor: tokens.colors.danger, ...hardShadow(4, tokens.colors.ink) },
    hover: { transform: [{ translateX: -1 }, { translateY: -1 }], ...hardShadow(6, tokens.colors.ink) },
    label: { color: tokens.colors.onAccent },
  },
  // Sur fond encre (hero) : bloc papier bordé encre, ombre dure petrol pour le pop.
  inverse: {
    container: { backgroundColor: tokens.colors.onInk, ...hardShadow(4, tokens.colors.accent) },
    hover: { transform: [{ translateX: -1 }, { translateY: -1 }], ...hardShadow(6, tokens.colors.accent) },
    label: { color: tokens.colors.text },
  },
  // Contour clair sur fond encre.
  outlineLight: {
    container: { backgroundColor: 'transparent', borderColor: tokens.colors.onInk },
    hover: { backgroundColor: 'rgba(235,231,220,0.14)' },
    label: { color: tokens.colors.onInk },
  },
};

/** Espace réservé exporté pour composer des rangées de boutons cohérentes. */
export function ButtonRow({ children }: { children: React.ReactNode }) {
  return <View style={rowStyles.row}>{children}</View>;
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.md },
});
