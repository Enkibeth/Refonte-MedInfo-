import { Image, StyleSheet, View } from 'react-native';

import { tokens } from './tokens';

/**
 * Logo MedInfo AI — image officielle (croix médicale + cervelet « circuit » + wordmark),
 * bleu pétrole sur fond transparent : `assets/brand/logo-wordmark.png` (05_DESIGN §6).
 *
 * Signature conservée (`size`, `tone`) pour ne rien casser chez les appelants.
 * `tone="light"` (hero, fond petrol foncé) : le logo étant bleu foncé, on le pose dans
 * un conteneur blanc arrondi plutôt que d'altérer la couleur de l'image (contraste).
 */

/** Largeurs cibles par taille ; la hauteur suit le ratio réel du wordmark détouré (~0.29). */
const WIDTHS = { sm: 120, md: 170, lg: 220 } as const;
const RATIO = 0.29; // hauteur / largeur de assets/brand/logo-wordmark.png (1024×297)

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

  const image = (
    <Image
      source={require('../../assets/brand/logo-wordmark.png')}
      style={{ width, height }}
      resizeMode="contain"
      accessibilityRole="header"
      accessibilityLabel="MedInfo AI"
    />
  );

  // Sur fond petrol foncé, encapsuler dans une pastille blanche pour garantir le contraste.
  if (tone === 'light') {
    return <View style={styles.lightChip}>{image}</View>;
  }
  return image;
}

const styles = StyleSheet.create({
  lightChip: {
    alignSelf: 'flex-start',
    backgroundColor: tokens.colors.onAccent,
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
    ...tokens.elevation.sm,
  },
});
