/**
 * Grain filmique — texture « grainy gradient » (concept Grainient / grainient.supply)
 * adaptée au design system MedInfo (05_DESIGN §4).
 *
 * Un bruit SVG (feTurbulence) posé en fine couche sur les fonds bleu nuit (hero,
 * dashboard, footer) donne une MATIÈRE au dégradé : le rendu cesse d'être un aplat
 * « template » plat, SANS ajouter d'orbe de glow (banni par l'audit design 2026-06,
 * `docs/audits/DESIGN_AUDIT_2026-06.md`). Le grain est statique → aucun mouvement à
 * neutraliser sous prefers-reduced-motion.
 *
 * Module PUR (aucune dépendance DOM) : le rendu se fait côté web dans
 * `GrainOverlay.web.tsx` ; en natif `GrainOverlay` est un no-op (raffinement web).
 */

export type GrainBlend = 'overlay' | 'soft-light' | 'normal';

export type GrainOverlayProps = {
  /** Opacité de la couche de grain (0–1). Défaut sobre, pensé pour du médical. */
  opacity?: number;
  /** Mode de fusion CSS avec le fond sous-jacent (dégradé/aplat bleu nuit). */
  blend?: GrainBlend;
};

/** Côté de la tuile de bruit répétée, en px. */
export const GRAIN_TILE = 140;

// Bruit fractal désaturé. baseFrequency élevée = grain FIN ; l'alpha du turbulence
// reste bruité → speckle semi-transparent (la « recette » d'un grainy gradient).
const GRAIN_SVG =
  `<svg xmlns='http://www.w3.org/2000/svg' width='${GRAIN_TILE}' height='${GRAIN_TILE}'>` +
  `<filter id='g'>` +
  `<feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/>` +
  `<feColorMatrix type='saturate' values='0'/>` +
  `</filter>` +
  `<rect width='100%' height='100%' filter='url(#g)'/>` +
  `</svg>`;

/**
 * Data-URI prêt pour `background-image: url("…")` (web).
 * `encodeURIComponent` échappe `<`, `>`, `#`, espaces — suffisant pour un data-URI
 * valide en CSS (les attributs SVG sont en apostrophes, jamais échappées).
 */
export function grainDataUri(): string {
  return 'data:image/svg+xml,' + encodeURIComponent(GRAIN_SVG);
}
