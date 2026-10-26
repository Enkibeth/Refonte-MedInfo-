import { Platform } from 'react-native';

/**
 * Attributs de la couche « Moniteur » de l'accueil (web seulement, ADR-0047).
 *
 * Comme `mi()` (src/ui/responsive.ts), pose `data-mi` pour rattacher un élément au CSS de
 * l'accueil (src/ui/landing/landingCss.ts) ; accepte en plus des attributs `data-*` d'état
 * (`{ i: '2' }` → `data-i="2"`) que le CSS lit pour ses transitions. Natif : rien.
 */
export function lx(names: string | (string | false | null | undefined)[], data?: Record<string, string>): {} {
  if (Platform.OS !== 'web') return {};
  const list = (Array.isArray(names) ? names : [names]).filter(Boolean).join(' ');
  return { dataSet: { mi: list, ...data } };
}
