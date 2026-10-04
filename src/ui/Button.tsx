import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { tokens } from './tokens';
import { useWindowWidth } from './useWindowWidth';

/**
 * Bouton MedInfo — primitive unique pour tous les écrans (05_DESIGN §5).
 * Variantes : primary (CTA bleu vif), secondary (contour clair, libellé encre), ghost (texte),
 * danger (contour rouge), inverse / outlineLight (sur fond sombre).
 *
 * États (révision 2026-10, « boutons ultra pro ») :
 *  - survol : fond plus dense (primaire) ou teinté (autres), filet renforcé ;
 *  - appui : fond encore plus dense — plus d'atténuation d'opacité, qui délavait le bouton ;
 *  - focus clavier : anneau 2 px décalé ;
 *  - désactivé : neutre et lisible (gris, libellé atténué, sans ombre) — un bleu délavé à
 *    50 % passait pour un bouton actif mal rendu ;
 *  - chargement : garde la couleur, le libellé et la taille ; indicateur à gauche.
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
  /** `link` quand le bouton ouvre une page ou une source externe. */
  accessibilityRole?: 'button' | 'link';
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
  accessibilityRole = 'button',
}: ButtonProps) {
  const isInactive = disabled || loading;
  const isDisabled = disabled && !loading;
  const v = variantStyles[variant];

  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? label}
      aria-disabled={isInactive}
      aria-busy={loading}
      disabled={isInactive}
      onPress={onPress}
      // react-native-web fournit `hovered` / `focused` au render-prop ; ignorés en natif.
      style={({ pressed, hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }) => [
        styles.base,
        size === 'lg' ? styles.lg : styles.md,
        v.container,
        fullWidth && styles.fullWidth,
        hovered && !isInactive && v.hover,
        pressed && !isInactive && v.pressed,
        focused && !isInactive && styles.focusRing,
        isDisabled && (v.disabled ?? styles.disabledFallback),
        loading && styles.loading,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={StyleSheet.flatten(v.label).color} />
      ) : leftIcon ? (
        <View style={styles.icon}>{leftIcon}</View>
      ) : null}
      <Text
        style={[styles.label, size === 'lg' ? styles.labelLg : styles.labelMd, v.label, isDisabled && v.disabled && styles.labelDisabled]}
      >
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
    borderWidth: tokens.border.thin,
    borderColor: 'transparent',
    ...tokens.motion.transitionWeb,
    ...(Platform.OS === 'web' ? ({ userSelect: 'none' } as ViewStyle) : null),
  },
  fullWidth: { alignSelf: 'stretch', width: '100%' },
  md: { minHeight: tokens.size.controlMd, paddingHorizontal: tokens.space.lg },
  lg: { minHeight: tokens.size.buttonLg, paddingHorizontal: tokens.space.xl },
  focusRing: tokens.focus.ring,
  // Variantes sans état désactivé propre (fond sombre) : atténuation uniforme.
  disabledFallback: { opacity: 0.5 },
  loading: Platform.OS === 'web' ? ({ cursor: 'progress' } as unknown as ViewStyle) : {},
  icon: { alignItems: 'center', justifyContent: 'center' },
  label: {
    fontFamily: tokens.font.display,
    fontWeight: tokens.weight.semibold,
    flexShrink: 1,
    textAlign: 'center',
    paddingVertical: tokens.space.sm,
  },
  labelMd: { fontSize: tokens.type.label.fontSize, lineHeight: tokens.type.label.lineHeight },
  labelLg: { fontSize: tokens.type.ui.fontSize, lineHeight: tokens.type.ui.lineHeight },
  labelDisabled: { color: tokens.colors.textMuted },
});

interface VariantStyle {
  container: ViewStyle;
  hover: ViewStyle;
  pressed: ViewStyle;
  /** Absent : atténuation uniforme (`disabledFallback`). */
  disabled?: ViewStyle;
  label: TextStyle;
}

/** Désactivé neutre : même gris pour toutes les variantes « pleines » ou bordées. */
const NEUTRAL_DISABLED: ViewStyle = {
  backgroundColor: tokens.colors.surfaceSunken,
  borderColor: tokens.colors.surfaceSunken,
  ...tokens.elevation.none,
};

const variantStyles: Record<Variant, VariantStyle> = {
  primary: {
    container: { backgroundColor: tokens.colors.accentVivid, borderColor: tokens.colors.accentVivid, ...tokens.elevation.controlPrimary },
    hover: { backgroundColor: tokens.colors.accentVividStrong, borderColor: tokens.colors.accentVividStrong },
    pressed: { backgroundColor: tokens.colors.accentVividPressed, borderColor: tokens.colors.accentVividPressed, ...tokens.elevation.none },
    disabled: NEUTRAL_DISABLED,
    label: { color: tokens.colors.onAccent },
  },
  secondary: {
    container: { backgroundColor: tokens.colors.surface, borderColor: tokens.colors.borderControl, ...tokens.elevation.control },
    hover: { backgroundColor: tokens.colors.surfaceHover, borderColor: tokens.colors.borderStrong },
    pressed: { backgroundColor: tokens.colors.surfaceSunken, borderColor: tokens.colors.borderStrong, ...tokens.elevation.none },
    disabled: { backgroundColor: tokens.colors.surface, borderColor: tokens.colors.border, ...tokens.elevation.none },
    label: { color: tokens.colors.text },
  },
  ghost: {
    container: { backgroundColor: tokens.colors.transparent },
    hover: { backgroundColor: tokens.colors.accentSurface },
    pressed: { backgroundColor: tokens.colors.accentSurfaceStrong },
    disabled: { backgroundColor: tokens.colors.transparent },
    label: { color: tokens.colors.accent },
  },
  danger: {
    container: { backgroundColor: tokens.colors.surface, borderColor: tokens.colors.danger, ...tokens.elevation.control },
    hover: { backgroundColor: tokens.colors.dangerBackground },
    pressed: { backgroundColor: tokens.colors.dangerBackground, ...tokens.elevation.none },
    disabled: { backgroundColor: tokens.colors.surface, borderColor: tokens.colors.border, ...tokens.elevation.none },
    label: { color: tokens.colors.danger },
  },
  // Pour fonds bleus/sombres (hero) : bouton blanc, texte bleu profond.
  inverse: {
    container: { backgroundColor: tokens.colors.onAccent, borderColor: tokens.colors.onAccent, ...tokens.elevation.md },
    hover: { backgroundColor: tokens.colors.surfaceAlt, borderColor: tokens.colors.surfaceAlt },
    pressed: { backgroundColor: tokens.colors.surfaceSunken, borderColor: tokens.colors.surfaceSunken },
    label: { color: tokens.colors.accentDeep },
  },
  // Contour clair sur fond sombre.
  outlineLight: {
    container: { backgroundColor: tokens.colors.transparent, borderColor: tokens.colors.onDarkBorder },
    hover: { backgroundColor: tokens.colors.onDarkHover, borderColor: tokens.colors.onAccent },
    pressed: { backgroundColor: tokens.colors.onDarkPressed, borderColor: tokens.colors.onAccent },
    label: { color: tokens.colors.onAccent },
  },
};

/** Secondaires d’abord, primaire en dernier : à droite ou en bas sur mobile. */
export function ButtonRow({ children }: { children: React.ReactNode }) {
  const width = useWindowWidth();
  return <View style={[rowStyles.row, width < tokens.layout.compact && rowStyles.mobile]}>{children}</View>;
}

const rowStyles = StyleSheet.create({
  row: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: tokens.space.md },
  mobile: { flexDirection: 'column', alignItems: 'stretch' },
});
