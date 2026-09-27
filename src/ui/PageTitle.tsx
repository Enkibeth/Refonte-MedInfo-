import { Text, StyleSheet, type TextProps } from 'react-native';
import { tokens } from './tokens';

/** Titre de page commun : serif, repère bleu et niveau de titre explicite. */
export function PageTitle({ style, children, ...props }: TextProps) {
  return <Text {...props} accessibilityRole="header" aria-level={1} style={[style, styles.title]}>{children}</Text>;
}
const styles = StyleSheet.create({ title: { fontFamily: tokens.font.serif, fontWeight: tokens.weight.regular, color: tokens.colors.text, ...tokens.type.h1, borderLeftWidth: tokens.border.accent, borderLeftColor: tokens.colors.accent, paddingLeft: tokens.space.lg } });
