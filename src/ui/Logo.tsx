import { View, Text, StyleSheet } from 'react-native';

import { tokens } from './tokens';

/**
 * Logo MedInfo AI — wordmark en code (croix médicale + texte), bleu pétrole (05_DESIGN §6).
 * Provisoire/robuste : pas d'asset binaire requis. Pour utiliser le logo image fourni,
 * remplacer ce composant par <Image source={require('@/assets/brand/logo-wordmark.png')} />
 * une fois le fichier déposé (cf assets/brand/README.md).
 */
export function Logo({
  size = 'md',
  tone = 'dark',
}: {
  size?: 'sm' | 'md' | 'lg';
  /** 'dark' : sur fond clair (défaut). 'light' : sur fond petrol/sombre (hero). */
  tone?: 'dark' | 'light';
}) {
  const fs = size === 'lg' ? 30 : size === 'sm' ? 17 : 23;
  const mark = Math.round(fs * 1.15);
  const light = tone === 'light';

  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="MedInfo AI">
      <View
        style={[
          styles.mark,
          light ? styles.markLight : null,
          { width: mark, height: mark, borderRadius: Math.round(mark * 0.3) },
        ]}
      >
        <View
          style={[styles.cross, light && styles.crossLight, { height: mark * 0.56, width: mark * 0.18 }]}
        />
        <View
          style={[styles.cross, light && styles.crossLight, { width: mark * 0.56, height: mark * 0.18 }]}
        />
      </View>
      <Text style={[styles.word, light && styles.wordLight, { fontSize: fs }]}>
        MedInfo<Text style={[styles.ai, light && styles.aiLight]}> AI</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.md },
  mark: {
    backgroundColor: tokens.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...tokens.elevation.sm,
  },
  markLight: { backgroundColor: tokens.colors.onAccent },
  cross: { position: 'absolute', backgroundColor: tokens.colors.onAccent, borderRadius: 2 },
  crossLight: { backgroundColor: tokens.colors.accent },
  word: {
    fontFamily: tokens.font.display,
    color: tokens.colors.accentDeep,
    fontWeight: tokens.weight.bold,
    letterSpacing: -0.4,
  },
  wordLight: { color: tokens.colors.onAccent },
  ai: { color: tokens.colors.accent, fontWeight: tokens.weight.semibold },
  aiLight: { color: tokens.colors.accentSurfaceStrong },
});
