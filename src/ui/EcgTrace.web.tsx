import { tokens } from './tokens';

/**
 * Tracé ECG animé — implémentation WEB (SVG inline). Variante claire (trait d'accent sur fond
 * clair) ou `tone="night"` (tracé menthe lumineux sur le bandeau bleu nuit du dashboard, ADR-0047). Animation `.medinfo-ecg-path` (keyframes dans
 * app/+html.tsx), coupée sous prefers-reduced-motion. Aucun état ni dépendance à la fenêtre :
 * rendu identique au pré-rendu et au client (pas de risque d'hydratation).
 */
export function EcgTrace({ height = 72, tone = 'light' }: { height?: number; tone?: 'light' | 'night' } = {}) {
  const night = tone === 'night';
  return (
    <div aria-hidden="true" style={{ ...wrapStyle, height }}>
      <svg viewBox="0 0 1200 160" preserveAspectRatio="none" style={svgStyle} focusable="false">
        <path
          className={night ? 'medinfo-ecg-path medinfo-ecg-night' : 'medinfo-ecg-path'}
          d="M0 80 H236 l16 0 10-26 14 52 10-26 H580 l14 0 10-38 16 70 12-32 H920 l12 0 8-20 12 38 8-18 H1200"
          fill="none"
          stroke={night ? tokens.colors.night.mint : tokens.colors.accent}
          strokeOpacity={night ? 0.9 : 0.45}
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
