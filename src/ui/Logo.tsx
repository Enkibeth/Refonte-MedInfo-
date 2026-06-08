import { Image, StyleSheet, View } from 'react-native';

import { tokens } from './tokens';

/**
 * Logo MedInfo AI — image officielle (croix médicale + cervelet « circuit » + wordmark),
 * `assets/brand/logo-wordmark.png` (PNG détouré, fond transparent — cf assets/brand/README.md).
 *
 * Tailles : largeur sm 120 / md 170 / lg 220, hauteur = largeur × 0.29 (ratio de l'asset).
 * En `tone="light"` (hero, fond petrol foncé), le logo bleu est posé dans une pastille blanche
 * arrondie pour le contraste — l'image n'est jamais recolorée.
 *
 * ⚠️ L'alias `@/*` pointe vers `./src/*` ; l'asset est à la racine `./assets`, d'où le chemin
 * relatif `../../assets/...` depuis `src/ui/`.
 */
const WIDTHS = { sm: 120, md: 170, lg: 220 } as const;
const RATIO = 0.29;

export function Logo({
  size = 'md',
  tone = 'dark',
}: {
  size?: 'sm' | 'md' | 'lg';
  /** 'dark' : sur fond clair (défaut). 'light' : sur fond petrol/sombre (hero). */
  tone?: 'dark' | 'light';
}) {
  const width = WIDTHS[size];
  const height = Math.round(width * RATIO);
  const light = tone === 'light';

  const image = (
    <Image
      source={require('../../assets/brand/logo-wordmark.png')}
      style={{ width, height }}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="MedInfo AI"
    />
  );

  if (!light) return image;

  // Sur fond sombre, pastille blanche pour le contraste (logo non recoloré).
  return <View style={styles.pill}>{image}</View>;
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: tokens.colors.surfacePure,
    borderRadius: tokens.radius.none,
    borderWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
  },
});
