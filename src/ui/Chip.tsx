import { Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from './icons';
import { mi } from './responsive';
import { tokens } from './tokens';
import { Touchable } from './Touchable';

/**
 * Puce de choix ou de filtre — UNE apparence pour tout le produit (05_DESIGN §5).
 *
 * Remplace cinq variantes faites main (scores en aplat bleu, révision bordée blanche, sexe en
 * gris, thèmes ECOS, fenêtres admin) dont le libellé flottait souvent en haut de la pastille.
 * Sélection : fond bleu très léger + filet et libellé accent + coche — lisible sans dépendre
 * de la couleur seule, et sans concurrencer le bouton principal bleu vif.
 *
 * Accessibilité : `role` fixe la sémantique (`radio` pour un choix unique, `checkbox` pour un
 * choix multiple, `button` pour un filtre) et l'état annoncé (`aria-checked` / `aria-pressed`).
 * Densité : 36 px au pointeur fin, 44 px au doigt (`pointer: coarse`, CHIP_CSS) ; sur natif, 44.
 */
export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: IconName;
  role?: 'radio' | 'checkbox' | 'button';
  disabled?: boolean;
  /** Masque la coche de sélection (puces porteuses d'une icône de catégorie). */
  hideCheck?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const IS_WEB = Platform.OS === 'web';

export function Chip({
  label,
  selected = false,
  onPress,
  icon,
  role = 'button',
  disabled = false,
  hideCheck = false,
  accessibilityLabel,
  style,
}: ChipProps) {
  const state = role === 'button' ? { 'aria-pressed': selected } : { 'aria-checked': selected };
  const showCheck = selected && !hideCheck && !icon;
  const iconColor = selected ? tokens.colors.accentDeep : tokens.colors.textMuted;
  return (
    <Touchable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel ?? label}
      {...state}
      {...mi('chip')}
      style={[styles.chip, selected && styles.selected, disabled && styles.disabled, style]}
    >
      {showCheck ? <Icon name="check" size={14} color={iconColor} /> : null}
      {icon ? (
        <View style={styles.icon}>
          <Icon name={icon} size={14} color={iconColor} />
        </View>
      ) : null}
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Touchable>
  );
}

/**
 * Rangée de puces : retour à la ligne, espacement constant. `label` (puces `radio`) en fait un
 * groupe nommé (`radiogroup`) : le lecteur d'écran annonce la question avant les choix.
 */
export function ChipRow({ children, style, label }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; label?: string }) {
  const group = label ? { accessibilityRole: 'radiogroup' as const, accessibilityLabel: label } : {};
  return (
    <View {...group} style={[styles.row, style]}>
      {children}
    </View>
  );
}

export const CHIP_HEIGHT = { fine: 36, coarse: tokens.size.controlMd } as const;

/**
 * Injecté dans le <head> web (app/+html.tsx) : cible tactile pleine sur écran tactile, pour les
 * puces et tout contrôle compact marqué `mi('touch44')` (segments, petites actions).
 */
export const CHIP_CSS = `
@media (pointer: coarse) {
  [data-mi~="chip"], [data-mi~="touch44"] { min-height: ${CHIP_HEIGHT.coarse}px !important; }
  [data-mi~="touch44"] { min-width: ${CHIP_HEIGHT.coarse}px !important; }
}
`;

const styles = StyleSheet.create({
  chip: {
    minHeight: IS_WEB ? CHIP_HEIGHT.fine : CHIP_HEIGHT.coarse,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: tokens.radius.pill,
    borderWidth: tokens.border.thin,
    borderColor: tokens.colors.borderControl,
    backgroundColor: tokens.colors.surface,
    ...tokens.motion.transitionWeb,
  },
  selected: {
    borderColor: tokens.colors.accent,
    backgroundColor: tokens.colors.accentSurface,
  },
  disabled: { opacity: 0.5 },
  icon: { alignItems: 'center', justifyContent: 'center' },
  label: {
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.caption.fontSize,
    lineHeight: 18,
    fontWeight: tokens.weight.medium,
    color: tokens.colors.textSubtle,
  },
  labelSelected: { color: tokens.colors.accentDeep, fontWeight: tokens.weight.semibold },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm },
});
