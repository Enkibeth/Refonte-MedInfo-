/**
 * Fond du hero — implémentation WEB.
 * Trois couches intentionnelles, liées au métier (pas de décor générique) :
 *   1. grille millimétrée très discrète (papier d'observation clinique) ;
 *   2. une seule source de lumière petrol en haut à gauche (éclairage assumé,
 *      pas d'orbes dégradés multiples) ;
 *   3. tracé ECG qui se dessine une fois au chargement (`.medinfo-ecg-path`,
 *      keyframes dans app/+html.tsx, neutralisé sous prefers-reduced-motion).
 * Rendu DOM inline (même approche éprouvée que icons.web.tsx).
 */
export function HeroBackdrop() {
  return (
    <div aria-hidden="true" style={layerStyle}>
      <div style={gridStyle} />
      <div style={lightStyle} />
      <svg
        viewBox="0 0 1200 160"
        preserveAspectRatio="none"
        style={ecgStyle}
        focusable="false"
      >
        <path
          className="medinfo-ecg-path"
          d="M0 80 H236 l16 0 10-26 14 52 10-26 H580 l14 0 10-38 16 70 12-32 H920 l12 0 8-20 12 38 8-18 H1200"
          fill="none"
          stroke="rgba(255,255,255,0.28)"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

const layerStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
  pointerEvents: 'none',
};

const gridStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundImage:
    'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
  backgroundSize: '32px 32px',
  // Fond de la grille estompé vers le bas : le contenu reste le sujet.
  maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.9), rgba(0,0,0,0.25) 70%, transparent)',
  WebkitMaskImage:
    'linear-gradient(to bottom, rgba(0,0,0,0.9), rgba(0,0,0,0.25) 70%, transparent)',
};

const lightStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'radial-gradient(640px 360px at 16% -6%, rgba(18,113,147,0.38), transparent 70%)',
};

const ecgStyle: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 24,
  width: '100%',
  height: 120,
};
