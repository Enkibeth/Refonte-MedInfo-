import { forwardRef, useState } from 'react';
import { Platform, StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

import { Icon } from './icons';
import { tokens } from './tokens';
import { Touchable } from './Touchable';

/**
 * Champ de recherche partagé (05_DESIGN §5 « Champ ») — ECOS, scores, historique du chat.
 *
 * UN seul cadre : loupe, saisie sans bordure propre, bouton « Effacer » de 44 px. Les écrans
 * posaient un `FieldInput` (déjà bordé) dans une boîte bordée → double cadre, ou une saisie
 * `outline: none` sans aucun indicateur de focus. Ici le focus colore le cadre et pose
 * l'anneau standard sur le conteneur entier.
 */
export interface SearchFieldProps extends Omit<TextInputProps, 'style' | 'value' | 'onChangeText'> {
  value: string;
  onChangeText: (text: string) => void;
  style?: StyleProp<ViewStyle>;
  /** Fond du cadre : blanc par défaut, papier dans les panneaux déjà blancs. */
  tone?: 'surface' | 'sunken';
}

export const SearchField = forwardRef<TextInput, SearchFieldProps>(function SearchField(
  { value, onChangeText, style, tone = 'surface', placeholder, accessibilityLabel, onFocus, onBlur, ...inputProps },
  ref,
) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.box, tone === 'sunken' && styles.sunken, focused && styles.focused, style]}>
      <Icon name="search" size={tokens.size.iconSm} color={tokens.colors.textMuted} />
      <TextInput
        ref={ref}
        {...inputProps}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={tokens.colors.textMuted}
        accessibilityLabel={accessibilityLabel ?? placeholder}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={styles.input}
      />
      {value !== '' ? (
        <Touchable
          onPress={() => onChangeText('')}
          accessibilityRole="button"
          accessibilityLabel="Effacer la recherche"
          {...(Platform.OS === 'web' ? { title: 'Effacer la recherche' } : {})}
          style={styles.clear}
        >
          <Icon name="x" size={tokens.size.iconSm} color={tokens.colors.textMuted} />
        </Touchable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  box: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    borderRadius: tokens.radius.md,
    borderWidth: tokens.border.thin,
    borderColor: tokens.colors.borderControl,
    backgroundColor: tokens.colors.surface,
    paddingLeft: tokens.space.md,
    paddingRight: tokens.space.xs,
    ...tokens.motion.transitionWeb,
  },
  sunken: { backgroundColor: tokens.colors.background },
  focused: { borderColor: tokens.colors.accent, ...tokens.focus.ring },
  input: {
    flex: 1,
    alignSelf: 'stretch',
    minWidth: 0,
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.input.fontSize,
    color: tokens.colors.text,
    paddingVertical: 0,
    ...(Platform.select({ web: { outlineStyle: 'none' } as object, default: {} }) as object),
  },
  clear: {
    width: tokens.size.iconButton,
    height: tokens.size.iconButton,
    borderRadius: tokens.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
