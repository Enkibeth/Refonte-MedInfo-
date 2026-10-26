import { tokens } from '@/ui/tokens';

/**
 * Tracé du hero (web) — signature « Moniteur » de l'accueil (ADR-0047).
 *
 * Un tracé ECG balayé comme sur un moniteur de surveillance : la nouvelle courbe se dessine
 * derrière une barre de balayage lumineuse pendant que l'ancienne s'efface devant elle, puis
 * le tracé se ramifie en trois pistes terminées par les nœuds du logo, aux couleurs des trois
 * assistants. Deux dessins : 3 battements à partir de 768 px, un et demi en dessous.
 *
 * Décoratif (`aria-hidden`), sans état ni dépendance à la fenêtre : rendu identique au
 * pré-rendu et au client. Animations dans landingCss.ts ; sous prefers-reduced-motion ou
 * animations figées, le tracé reste affiché, immobile.
 */
const WIDE = {
  viewBox: '0 0 1440 120',
  d:
    'M0 60 L40 60 Q55 51 70 60 L90 60 L96 66 L104 14 L112 76 L118 60 L150 60 Q174 44 198 60 L360 60 ' +
    'L400 60 Q415 51 430 60 L450 60 L456 66 L464 14 L472 76 L478 60 L510 60 Q534 44 558 60 L720 60 ' +
    'L760 60 Q775 51 790 60 L810 60 L816 66 L824 14 L832 76 L838 60 L870 60 Q894 44 918 60 L1180 60 ' +
    'L1236 60 L1266 30 L1398 30 M1236 60 L1398 60 M1236 60 L1266 90 L1398 90',
  nodes: [
    { x: 1406, y: 30, color: tokens.colors.night.mint },
    { x: 1406, y: 60, color: tokens.colors.night.lilac },
    { x: 1406, y: 90, color: tokens.colors.night.blue },
  ],
};
const COMPACT = {
  viewBox: '0 0 720 120',
  d:
    'M0 60 L40 60 Q55 51 70 60 L90 60 L96 66 L104 14 L112 76 L118 60 L150 60 Q174 44 198 60 L360 60 ' +
    'L400 60 Q415 51 430 60 L450 60 L456 66 L464 14 L472 76 L478 60 L510 60 Q534 44 558 60 L580 60 ' +
    'L610 60 L640 32 L690 32 M610 60 L690 60 M610 60 L640 88 L690 88',
  nodes: [
    { x: 698, y: 32, color: tokens.colors.night.mint },
    { x: 698, y: 60, color: tokens.colors.night.lilac },
    { x: 698, y: 88, color: tokens.colors.night.blue },
  ],
};

function Drawing({ shape }: { shape: typeof WIDE }) {
  return (
    <svg viewBox={shape.viewBox} preserveAspectRatio="xMidYMid meet" focusable="false" style={svgStyle}>
      <path d={shape.d} fill="none" stroke={tokens.colors.night.mint} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {shape.nodes.map((node) => (
        <g key={node.y}>
          <circle data-mi="lx-node" cx={node.x} cy={node.y} r={7} fill="none" stroke={node.color} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
          <circle cx={node.x} cy={node.y} r={3.2} fill={node.color} />
        </g>
      ))}
    </svg>
  );
}

function Layer({ shape }: { shape: typeof WIDE }) {
  return (
    <div data-mi="lx-trace-shape" style={layerStyle}>
      <div data-mi="lx-trace-new" style={fillStyle}><Drawing shape={shape} /></div>
      <div data-mi="lx-trace-old" style={overlayStyle}><Drawing shape={shape} /></div>
      <div data-mi="lx-trace-scan" style={scanStyle} />
    </div>
  );
}

export function HeroTrace() {
  return (
    <div aria-hidden="true" data-mi="lx-trace" style={wrapStyle}>
      <div data-mi="ge768" style={variantStyle}><Layer shape={WIDE} /></div>
      <div data-mi="lt768" style={variantStyle}><Layer shape={COMPACT} /></div>
    </div>
  );
}

const wrapStyle: React.CSSProperties = { position: 'relative', width: '100%', pointerEvents: 'none' };
const variantStyle: React.CSSProperties = { width: '100%' };
const layerStyle: React.CSSProperties = { position: 'relative', width: '100%' };
const fillStyle: React.CSSProperties = { width: '100%' };
const overlayStyle: React.CSSProperties = { position: 'absolute', inset: 0 };
const svgStyle: React.CSSProperties = { display: 'block', width: '100%', height: 'auto', overflow: 'visible' };
const scanStyle: React.CSSProperties = { position: 'absolute', inset: 0, pointerEvents: 'none' };
