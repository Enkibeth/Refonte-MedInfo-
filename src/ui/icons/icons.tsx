import { Image } from 'react-native';

import { tokens } from '@/ui/theme/tokens';
import { ICON_PATHS, GOOGLE_SVG, APPLE_SVG, type IconName } from './iconPaths';

/**
 * Icônes ligne (style Lucide) — implémentation NATIVE.
 * Rendu sans dépendance via data-URI SVG dans <Image>. Sur web, c'est
 * `icons.web.tsx` (SVG inline) qui est utilisé : le data-URI est peu fiable
 * dans l'export web de production (icônes invisibles).
 */
export type { IconName };

export function Icon({
  name,
  size = 20,
  color = tokens.colors.text,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  const stroke = size <= 20 ? 1.75 : 2;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" ` +
    `fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="${ICON_PATHS[name]}"/></svg>`;
  return (
    <Image
      accessibilityIgnoresInvertColors
      source={{ uri: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` }}
      style={{ width: size, height: size }}
    />
  );
}

export function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <Image accessibilityIgnoresInvertColors source={{ uri: GOOGLE_SVG }} style={{ width: size, height: size }} />
  );
}

export function AppleIcon({ size = 20 }: { size?: number }) {
  return (
    <Image accessibilityIgnoresInvertColors source={{ uri: APPLE_SVG }} style={{ width: size, height: size }} />
  );
}
