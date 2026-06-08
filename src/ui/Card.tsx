import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { tokens } from './tokens';

/**
 * Carte de contenu (refonte « brutalisme structuré »). Bloc à angle vif, bordure
 * encre franche, fond surface. Au repos : PLAT (le trait suffit). Pour mettre en
 * avant, passer `elevation="md"|"lg"` → ombre DURE décalée (jamais de flou).
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
  /** Profondeur (défaut `sm` = plat). `md`/`lg` = ombre dure décalée. */
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
    borderRadius: tokens.radius.none,
    backgroundColor: tokens.colors.surface,
    borderWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
    ...tokens.motion.transitionWeb,
  },
  padded: { padding: tokens.space.xl },
});
