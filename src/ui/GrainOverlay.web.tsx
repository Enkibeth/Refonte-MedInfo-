import { GRAIN_TILE, grainDataUri, type GrainOverlayProps } from './grain';

/**
 * Couche de grain — implémentation WEB (concept Grainient, 05_DESIGN §4).
 *
 * DOM inline (même approche éprouvée que HeroBackdrop.web.tsx / icons.web.tsx : un
 * data-URI SVG en `background-image` CSS s'affiche correctement sur l'export web de
 * production, contrairement aux data-URI SVG dans un `<Image>` — piège documenté).
 *
 * Posé sur un fond SOMBRE (bleu nuit) en `mix-blend-mode` : le grain module
 * finement lumière/ombre pour donner de la matière au dégradé. Purement décoratif
 * (`aria-hidden`, `pointer-events:none`).
 */
export function GrainOverlay({ opacity = 0.3, blend = 'overlay' }: GrainOverlayProps) {
  return <div aria-hidden="true" style={{ ...baseStyle, opacity, mixBlendMode: blend }} />;
}

const baseStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  backgroundImage: `url("${grainDataUri()}")`,
  backgroundSize: `${GRAIN_TILE}px ${GRAIN_TILE}px`,
  backgroundRepeat: 'repeat',
};
