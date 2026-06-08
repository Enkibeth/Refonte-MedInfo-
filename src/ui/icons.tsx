import { Image } from 'react-native';

import { tokens } from './tokens';

/**
 * Icônes ligne (style Lucide, design system §6) : stroke 2 px, currentColor.
 * Rendu sans dépendance native via data-URI SVG (web + natif), couleur injectée
 * à la volée. Tailles canoniques : 16 / 20 / 24 / 32.
 */
const ICON_PATHS = {
  stethoscope:
    'M11 2v2 M5 2v2 M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1 M8 15a6 6 0 0 0 12 0v-3 M20 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z',
  brain:
    'M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z',
  users:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  shield:
    'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z M9 12l2 2 4-4',
  sparkles:
    'm12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z',
  bookOpen:
    'M12 7v14 M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
  arrowRight: 'M5 12h14 M13 6l6 6-6 6',
  arrowUp: 'M12 19V5 M5 12l7-7 7 7',
} as const;

export type IconName = keyof typeof ICON_PATHS;

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

/**
 * Icônes de marque (Google, Apple) pour les boutons OAuth.
 * Rendu via data-URI SVG : net et sans dépendance native supplémentaire (web-first).
 * Les marques imposent leurs logos officiels — ne pas recolorer.
 */
const GOOGLE_SVG =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCIgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4Ij48cGF0aCBmaWxsPSIjRkZDMTA3IiBkPSJNNDMuNjExIDIwLjA4M0g0MlYyMEgyNHY4aDExLjMwM2MtMS42NDkgNC42NTctNi4wOCA4LTExLjMwMyA4LTYuNjI3IDAtMTItNS4zNzMtMTItMTJzNS4zNzMtMTIgMTItMTJjMy4wNTkgMCA1Ljg0MiAxLjE1NCA3Ljk2MSAzLjAzOWw1LjY1Ny01LjY1N0MzNC4wNDYgNi4wNTMgMjkuMjY4IDQgMjQgNCAxMi45NTUgNCA0IDEyLjk1NSA0IDI0czguOTU1IDIwIDIwIDIwIDIwLTguOTU1IDIwLTIwYzAtMS4zNDEtLjEzOC0yLjY1LS4zODktMy45MTd6Ii8+PHBhdGggZmlsbD0iI0ZGM0QwMCIgZD0iTTYuMzA2IDE0LjY5MWw2LjU3MSA0LjgxOUMxNC42NTUgMTUuMTA4IDE4Ljk2MSAxMiAyNCAxMmMzLjA1OSAwIDUuODQyIDEuMTU0IDcuOTYxIDMuMDM5bDUuNjU3LTUuNjU3QzM0LjA0NiA2LjA1MyAyOS4yNjggNCAyNCA0IDE2LjMxOCA0IDkuNjU2IDguMzM3IDYuMzA2IDE0LjY5MXoiLz48cGF0aCBmaWxsPSIjNENBRjUwIiBkPSJNMjQgNDRjNS4xNjYgMCA5Ljg2LTEuOTc3IDEzLjQwOS01LjE5MmwtNi4xOS01LjIzOEMyOS4yMTEgMzUuMDkxIDI2LjcxNSAzNiAyNCAzNmMtNS4yMDIgMC05LjYxOS0zLjMxNy0xMS4yODMtNy45NDZsLTYuNTIyIDUuMDI1QzkuNTA1IDM5LjU1NiAxNi4yMjcgNDQgMjQgNDR6Ii8+PHBhdGggZmlsbD0iIzE5NzZEMiIgZD0iTTQzLjYxMSAyMC4wODNINDJWMjBIMjR2OGgxMS4zMDNjLS43OTIgMi4yMzctMi4yMzEgNC4xNjYtNC4wODcgNS41NzFsLjAwMy0uMDAyIDYuMTkgNS4yMzhDMzYuOTcxIDM5LjIwNSA0NCAzNCA0NCAyNGMwLTEuMzQxLS4xMzgtMi42NS0uMzg5LTMuOTE3eiIvPjwvc3ZnPgo=';

const APPLE_SVG =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0Ij48cGF0aCBmaWxsPSIjMEYxQjIyIiBkPSJNMTYuMzY1IDEuNDNjMCAxLjE0LS40OTMgMi4yNy0xLjE3NyAzLjA4LS43NDQuOS0xLjk5IDEuNTctMi45ODcgMS41Ny0uMTIgMC0uMjMtLjAyLS4zLS4wMy0uMDEtLjA2LS4wNC0uMjItLjA0LS4zOSAwLTEuMTUuNTcyLTIuMjcgMS4yMDYtMi45OC44MDQtLjk0IDIuMTQyLTEuNjQgMy4yNDgtMS42OC4wMy4xMy4wNS4yOC4wNS40M3ptNC41NjUgMTUuNzFjLS4wMy4wNy0uNDYzIDEuNTgtMS41MTggMy4xMi0uOTQ1IDEuMzQtMS45NCAyLjcxLTMuNDMgMi43NC0xLjUxNy4wMy0yLjAyLS44Ny0zLjcxLS44Ny0xLjY4MyAwLTIuMTguODQtMy42MS45LTEuNDYuMDYtMi42MS0xLjQ2LTMuNjItMi44NC0xLjk3LTIuNy0zLjQ4LTcuNjYtMS40NS0xMS4wMS45ODUtMS42NSAyLjc2LTIuNjkgNC42OS0yLjcyIDEuNDUtLjAzIDIuODEuOTYgMy43MS45Ni45MSAwIDIuNTYtMS4xOCA0LjMyLTEuMDEuNzMuMDMgMi43OS4zIDQuMTEgMi4yNi0uMTA1LjA3LTIuNDU1IDEuNDItMi40MyA0LjI2LjAzIDMuNCAyLjk3IDQuNTIgMyA0LjUzeiIvPjwvc3ZnPgo=';

export function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <Image
      accessibilityIgnoresInvertColors
      source={{ uri: GOOGLE_SVG }}
      style={{ width: size, height: size }}
    />
  );
}

export function AppleIcon({ size = 20 }: { size?: number }) {
  return (
    <Image
      accessibilityIgnoresInvertColors
      source={{ uri: APPLE_SVG }}
      style={{ width: size, height: size }}
    />
  );
}
