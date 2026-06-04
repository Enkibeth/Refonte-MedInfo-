import { View, Text, StyleSheet } from 'react-native';

import { tokens } from './tokens';

/**
 * Logo MedInfo AI — wordmark en code (croix médicale + texte), bleu pétrole (05_DESIGN).
 * Provisoire/robuste : pas d'asset binaire requis. Pour utiliser le logo image fourni,
 * remplacer ce composant par <Image source={require('@/assets/brand/logo-wordmark.png')} />
 * une fois le fichier déposé (cf assets/brand/README.md).
 */
export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const fs = size === 'lg' ? 34 : size === 'sm' ? 18 : 26;
  const mark = Math.round(fs * 1.05);

  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="MedInfo AI">
      <View
        style={[
          styles.mark,
          { width: mark, height: mark, borderRadius: Math.round(mark * 0.28) },
        ]}
      >
        <View style={[styles.cross, styles.crossV, { height: mark * 0.62, width: mark * 0.2 }]} />
        <View style={[styles.cross, styles.crossH, { width: mark * 0.62, height: mark * 0.2 }]} />
      </View>
      <Text style={[styles.word, { fontSize: fs }]}>
        MedInfo <Text style={styles.ai}>AI</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: {
    backgroundColor: tokens.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cross: { position: 'absolute', backgroundColor: tokens.colors.background, borderRadius: 2 },
  crossV: {},
  crossH: {},
  word: { color: tokens.colors.accentDeep, fontWeight: '800', letterSpacing: 0.3 },
  ai: { color: tokens.colors.accent },
});
