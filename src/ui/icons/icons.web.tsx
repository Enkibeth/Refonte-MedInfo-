import { tokens } from '@/ui/theme/tokens';
import { ICON_PATHS, GOOGLE_SVG, APPLE_SVG, type IconName } from './iconPaths';

/**
 * Icônes ligne (style Lucide) — implémentation WEB.
 * Rend un <svg> inline réel (react-native-web s'appuie sur react-dom) : c'est fiable
 * dans l'export web de production, contrairement au data-URI <Image> (icônes invisibles).
 * Metro/Expo préfère automatiquement ce fichier `.web.tsx` côté web.
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
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

export function GoogleIcon({ size = 20 }: { size?: number }) {
  return <img src={GOOGLE_SVG} width={size} height={size} alt="" aria-hidden="true" style={{ display: 'block' }} />;
}

export function AppleIcon({ size = 20 }: { size?: number }) {
  return <img src={APPLE_SVG} width={size} height={size} alt="" aria-hidden="true" style={{ display: 'block' }} />;
}
