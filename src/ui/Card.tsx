import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { tokens } from './tokens';

/**
 * Carte de contenu (05_DESIGN §4). Surface surélevée discrète : bordure fine +
 * ombre légère plutôt qu'un gros rayon « template ». Rayon mesuré (lg = 16).
 */
export function Card({
  children,
  style,
  padded = true,
  elevation = 'sm',
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  /** Profondeur de la carte (défaut `sm`). `md`/`lg` pour les surfaces mises en avant. */
  elevation?: 'sm' | 'md' | 'lg';
}) {
  return (
    <View style={[styles.card, tokens.elevation[elevation], padded && styles.padded, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    ...tokens.motion.transitionWeb,
  },
  padded: { padding: tokens.space.xl },
});
