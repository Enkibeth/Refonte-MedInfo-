import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { tokens } from '@/ui/theme/tokens';

/**
 * Bouton MedInfo — primitive unique pour tous les écrans (05_DESIGN §5).
 * Variantes : primary (CTA petrol), secondary (contour), ghost (texte), danger.
 * États gérés : pressed (translation/opacité sobre), disabled, loading.
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
      // react-native-web fournit `hovered` / `focused` au render-prop ; ignorés en natif.
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
            variant === 'inverse'
              ? tokens.colors.accent
              : variant === 'primary' || variant === 'danger' || variant === 'outlineLight'
                ? tokens.colors.onAccent
                : tokens.colors.accent
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
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    ...tokens.motion.transitionWeb,
  },
  fullWidth: { alignSelf: 'stretch' },
  md: { minHeight: tokens.size.controlMd, paddingHorizontal: tokens.space.lg },
  lg: { minHeight: tokens.size.controlLg, paddingHorizontal: tokens.space.xl },
  // Appui : léger enfoncement (scale 0.98) — retour tactile net, sans rebond.
  pressed: { opacity: 0.95, transform: [{ scale: 0.98 }] },
  focusRing: tokens.focus.ring,
  disabled: { opacity: 0.5 },
  icon: { alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: tokens.font.sans, fontWeight: tokens.weight.semibold },
  labelMd: { fontSize: tokens.type.label.fontSize },
  labelLg: { fontSize: tokens.type.bodyLg.fontSize },
});

const variantStyles: Record<Variant, { container: ViewStyle; hover: ViewStyle; label: { color: string } }> = {
  primary: {
    // Essai 2026-06 : CTA en bleu vif (tokens.colors.accentVivid) — revenir à
    // tokens.colors.accent / accentStrong pour retrouver le petrol d'origine.
    container: { backgroundColor: tokens.colors.accentVivid, ...tokens.elevation.sm },
    // Survol : teinte plus dense + légère élévation/remontée → CTA « vivant » mais sobre.
    hover: { backgroundColor: tokens.colors.accentVividStrong, transform: [{ translateY: -1 }], ...tokens.elevation.md },
    label: { color: tokens.colors.onAccent },
  },
  secondary: {
    container: { backgroundColor: tokens.colors.surface, borderColor: tokens.colors.borderStrong },
    hover: { backgroundColor: tokens.colors.surfaceHover, borderColor: tokens.colors.accent },
    label: { color: tokens.colors.accentDeep },
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    hover: { backgroundColor: tokens.colors.accentSurface },
    label: { color: tokens.colors.accent },
  },
  danger: {
    container: { backgroundColor: tokens.colors.danger },
    hover: { transform: [{ translateY: -1 }], ...tokens.elevation.md },
    label: { color: tokens.colors.onAccent },
  },
  // Pour fonds petrol/sombres (hero) : bouton blanc, texte petrol.
  inverse: {
    container: { backgroundColor: tokens.colors.onAccent, ...tokens.elevation.md },
    hover: { transform: [{ translateY: -1 }], ...tokens.elevation.lg },
    label: { color: tokens.colors.accentDeep },
  },
  // Contour clair sur fond sombre.
  outlineLight: {
    container: { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.55)' },
    hover: { backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.85)' },
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
