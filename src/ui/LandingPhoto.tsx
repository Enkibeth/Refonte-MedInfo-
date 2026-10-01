import { Image, StyleSheet, View } from 'react-native';
import { LANDING_PHOTOS, type LandingPhotoProps } from './landingPhotos';
import { tokens } from './tokens';

const images = {
  study: require('../../assets/landing/study.jpg'),
  work: require('../../assets/landing/work.jpg'),
  sources: require('../../assets/landing/sources.jpg'),
};

/** JPEG local pour les applications natives ; variante web avec tailles adaptatives. */
export function LandingPhoto({ photo, aspectRatio = 3 / 2 }: LandingPhotoProps) {
  return <View style={{ aspectRatio, width: '100%', backgroundColor: tokens.colors.surfaceAlt, borderRadius: tokens.radius.md, overflow: 'hidden' }}>
    <Image source={images[photo]} accessibilityLabel={LANDING_PHOTOS[photo]} resizeMode="cover" style={StyleSheet.absoluteFill} />
  </View>;
}
