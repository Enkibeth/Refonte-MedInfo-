import type { GrainOverlayProps } from './grain';

/**
 * Couche de grain — no-op en NATIF (le grain filmique est un raffinement web ;
 * la version web, GrainOverlay.web.tsx, est résolue automatiquement par Metro).
 */
export function GrainOverlay(_props: GrainOverlayProps) {
  return null;
}
