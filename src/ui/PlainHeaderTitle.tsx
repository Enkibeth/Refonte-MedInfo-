import { StyleSheet, Text, type ColorValue } from 'react-native';

import { tokens } from './tokens';

/**
 * Titre de barre de navigation SANS rôle de titre de section (`headerTitle` des piles).
 *
 * Le titre par défaut de React Navigation est annoncé comme titre de niveau 1 : avec le
 * titre propre de l'écran, la page comptait deux `<h1>` (« Compte » + « Mon compte »).
 */
export function PlainHeaderTitle({ children, tintColor }: { children: string; tintColor?: ColorValue }) {
  return (
    <Text numberOfLines={1} style={[styles.title, tintColor ? { color: tintColor } : null]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: tokens.font.display,
    fontSize: 17,
    fontWeight: tokens.weight.semibold,
    color: tokens.colors.text,
  },
});
