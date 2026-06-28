import { StyleSheet, View } from 'react-native';

import { tokens } from '@/ui/theme/tokens';

/**
 * Fond du hero — implémentation NATIVE (repli sobre).
 * Une seule source de lumière douce en haut (pas d'orbes multiples « template »).
 * La version web (HeroBackdrop.web.tsx) ajoute la grille millimétrée et le tracé
 * ECG animé ; Metro la résout automatiquement côté web.
 */
export function HeroBackdrop() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.light} />
    </View>
  );
}

const styles = StyleSheet.create({
  light: {
    position: 'absolute',
    top: -220,
    left: -80,
    width: 520,
    height: 520,
    borderRadius: 999,
    backgroundColor: tokens.colors.accentStrong,
    opacity: 0.16,
  },
});
