import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { tokens } from './tokens';

/**
 * Bouton MedInfo — primitive unique pour tous les écrans (05_DESIGN §5).
 * Variantes : primary (CTA bleu électrique), secondary (contour), ghost (texte), danger.
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
            variant === 'inverse' || variant === 'danger'
              ? tokens.colors.accent
              : variant === 'primary' || variant === 'outlineLight'
                ? tokens.colors.onAccent
                : tokens.colors.accent
          }
        />
      ) : leftIcon ? (
        <View style={styles.icon}>{leftIcon}</View>
      ) : null}
      <Text style={[styles.label, size === 'lg' ? styles.labelLg : styles.labelMd, v.label]}>
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
  fullWidth: { alignSelf: 'stretch', width: '100%' },
  md: { minHeight: tokens.size.controlMd, paddingHorizontal: tokens.space.lg },
  lg: { minHeight: tokens.size.controlLg, paddingHorizontal: tokens.space.xl },
  // Appui : léger enfoncement (scale 0.98) — retour tactile net, sans rebond.
  pressed: { opacity: 0.85 },
  focusRing: tokens.focus.ring,
  disabled: { opacity: 0.5 },
  icon: { alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: tokens.font.display, fontWeight: tokens.weight.medium, flexShrink: 1, textAlign: 'center', paddingVertical: tokens.space.sm },
  labelMd: { fontSize: tokens.type.label.fontSize },
  labelLg: { fontSize: tokens.type.bodyLg.fontSize },
});

const variantStyles: Record<Variant, { container: ViewStyle; hover: ViewStyle; label: { color: string } }> = {
  primary: {
    // CTA en bleu électrique (tokens.colors.accentVivid) — identité 2026-07.
    container: { backgroundColor: tokens.colors.accentVivid, ...tokens.elevation.sm },
    // Survol : teinte plus dense + légère élévation/remontée → CTA « vivant » mais sobre.
    hover: { backgroundColor: tokens.colors.accentVividStrong },
    label: { color: tokens.colors.onAccent },
  },
  secondary: {
    container: { backgroundColor: tokens.colors.surface, borderColor: tokens.colors.borderStrong },
    hover: { backgroundColor: tokens.colors.surfaceHover, borderColor: tokens.colors.accent },
    label: { color: tokens.colors.accentDeep },
  },
  ghost: {
    container: { backgroundColor: tokens.colors.transparent },
    hover: { backgroundColor: tokens.colors.accentSurface },
    label: { color: tokens.colors.accent },
  },
  danger: {
    container: { backgroundColor: tokens.colors.surface, borderColor: tokens.colors.danger },
    hover: { backgroundColor: tokens.colors.dangerBackground },
    label: { color: tokens.colors.danger },
  },
  // Pour fonds bleus/sombres (hero) : bouton blanc, texte bleu profond.
  inverse: {
    container: { backgroundColor: tokens.colors.onAccent, ...tokens.elevation.md },
    hover: { backgroundColor: tokens.colors.surfaceAlt },
    label: { color: tokens.colors.accentDeep },
  },
  // Contour clair sur fond sombre.
  outlineLight: {
    container: { backgroundColor: tokens.colors.transparent, borderColor: tokens.colors.onDarkBorder },
    hover: { backgroundColor: tokens.colors.onDarkHover, borderColor: tokens.colors.onAccent },
    label: { color: tokens.colors.onAccent },
  },
};

/** Secondaires d’abord, primaire en dernier : à droite ou en bas sur mobile. */
export function ButtonRow({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  return <View style={[rowStyles.row, width < tokens.layout.compact && rowStyles.mobile]}>{children}</View>;
}

const rowStyles = StyleSheet.create({
  row: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: tokens.space.md },
  mobile: { flexDirection: 'column', alignItems: 'stretch' },
});
