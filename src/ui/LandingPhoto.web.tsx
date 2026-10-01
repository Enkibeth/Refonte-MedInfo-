import { View } from 'react-native';
import { LANDING_PHOTOS, type LandingPhotoProps } from './landingPhotos';
import { tokens } from './tokens';

// Expo/Metro émet les assets web sous forme { uri, width, height }.
// Image.resolveAssetSource appartient au natif et n’existe pas dans react-native-web.
const images: Record<LandingPhotoProps['photo'], readonly [{ uri: string }, { uri: string }]> = {
  study: [require('../../assets/landing/medical-study-640.webp'), require('../../assets/landing/medical-study-1000.webp')],
  work: [require('../../assets/landing/work-640.webp'), require('../../assets/landing/work-1000.webp')],
  sources: [require('../../assets/landing/sources-640.webp'), require('../../assets/landing/sources-1000.webp')],
};

/** Fichiers servis par l’application : aucun appel à une banque d’images au chargement. */
export function LandingPhoto({ photo, aspectRatio = 3 / 2, priority = false, sizes = '(min-width: 1200px) 544px, (min-width: 1024px) calc((100vw - 112px) / 2), (min-width: 640px) calc(100vw - 48px), calc(100vw - 32px)' }: LandingPhotoProps) {
  const [small, large] = images[photo].map(source => source.uri);
  return <View style={{ aspectRatio, width: '100%', backgroundColor: tokens.colors.surfaceAlt, borderRadius: tokens.radius.md, overflow: 'hidden' }}>
    <img
      src={large}
      srcSet={`${small} 640w, ${large} 1000w`}
      sizes={sizes}
      alt={LANDING_PHOTOS[photo]}
      width={1000}
      height={667}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      style={{ position: 'absolute', inset: 0, display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
    />
  </View>;
}
