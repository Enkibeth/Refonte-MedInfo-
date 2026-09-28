import { tokens } from './tokens';

/**
 * Tracé ECG animé de la page d'accueil — implémentation WEB (SVG inline, même approche que
 * `HeroBackdrop.web.tsx`). Variante claire : trait couleur d'accent sur fond clair, pour la
 * direction éditoriale de la refonte 2026-09. Animation `.medinfo-ecg-path` (keyframes dans
 * app/+html.tsx), coupée sous prefers-reduced-motion. Aucun état ni dépendance à la fenêtre :
 * rendu identique au pré-rendu et au client (pas de risque d'hydratation).
 */
export function EcgTrace({ height = 72 }: { height?: number } = {}) {
  return (
    <div aria-hidden="true" style={{ ...wrapStyle, height }}>
      <svg viewBox="0 0 1200 160" preserveAspectRatio="none" style={svgStyle} focusable="false">
        <path
          className="medinfo-ecg-path"
          d="M0 80 H236 l16 0 10-26 14 52 10-26 H580 l14 0 10-38 16 70 12-32 H920 l12 0 8-20 12 38 8-18 H1200"
          fill="none"
          stroke={tokens.colors.accent}
          strokeOpacity={0.45}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

const wrapStyle: React.CSSProperties = {
  width: '100%',
  pointerEvents: 'none',
  overflow: 'hidden',
};

const svgStyle: React.CSSProperties = { width: '100%', height: '100%', display: 'block' };
