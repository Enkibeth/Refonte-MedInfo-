import { Text, StyleSheet, type TextProps } from 'react-native';
import { tokens } from './tokens';

/**
 * Titre de page commun : serif et niveau de titre explicite.
 * (2026-10 : filet bleu vertical retiré : tic de gabarit, qui décalait aussi le titre de
 * 19 px par rapport à la colonne qu'il coiffe.)
 */
export function PageTitle({ style, children, ...props }: TextProps) {
  return <Text {...props} accessibilityRole="header" aria-level={1} style={[style, styles.title]}>{children}</Text>;
}
const styles = StyleSheet.create({ title: { fontFamily: tokens.font.serif, fontWeight: tokens.weight.regular, color: tokens.colors.text, ...tokens.type.h1 } });
