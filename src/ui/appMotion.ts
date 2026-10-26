import { tokens } from './tokens';

/**
 * Mouvement et relief de l'espace connecté (web) — refonte créative 2026-10, ADR-0047.
 *
 * Injecté dans le <head> (app/+html.tsx). Les écrans de l'espace ne sont pas pré-rendus avec
 * leurs données : ces entrées jouent au montage, sans risque d'hydratation. Sous
 * prefers-reduced-motion, la règle globale d'app/+html.tsx ramène chaque animation à son état
 * final (affiché d'emblée).
 *
 *  - `ax-in` : entrée échelonnée d'un bloc (`data-ad="n"` = rang dans la séquence) ;
 *  - `ax-lift` : carte qui se soulève au survol, sa flèche `ax-arrow` glisse ;
 *  - `ax-night` : bandeau « moniteur » (papier millimétré d'ECG + halo localisé).
 */
const n = tokens.colors.night;
const EASE_OUT = 'cubic-bezier(.19,1,.22,1)';
const ranks = Array.from({ length: 16 }, (_, i) => `[data-ad="${i}"]{--ax-d:${i}}`).join('');

export const APP_MOTION_CSS = `
/* ── Espace connecté : mouvement et relief (src/ui/appMotion.ts) ── */
${ranks}
[data-mi~="ax-in"] { animation: ax-in 620ms ${EASE_OUT} both; animation-delay: calc(var(--ax-d, 0) * 60ms + 40ms); }
@keyframes ax-in { from { opacity: 0; transform: translate3d(0, 10px, 0); } to { opacity: 1; transform: none; } }
[data-mi~="ax-lift"] { transition: transform 260ms ${EASE_OUT}, box-shadow 260ms ${EASE_OUT}, border-color 180ms ease; }
[data-mi~="ax-arrow"] { transition: transform 260ms ${EASE_OUT}, opacity 200ms ease; }
@media (hover: hover) and (pointer: fine) {
  [data-mi~="ax-lift"]:hover { transform: translate3d(0, -2px, 0); box-shadow: 0 1px 2px rgba(20,30,78,.06), 0 14px 28px -14px rgba(20,30,78,.28); }
  [data-mi~="ax-lift"] [data-mi~="ax-arrow"] { opacity: .45; }
  [data-mi~="ax-lift"]:hover [data-mi~="ax-arrow"] { opacity: 1; transform: translate3d(3px, 0, 0); }
}
[data-mi~="ax-lift"]:active { transform: scale(.99); }
[data-mi~="ax-night"] {
  background:
    radial-gradient(ellipse 45% 70% at 92% 0%, rgba(0,103,255,.34), transparent 70%),
    radial-gradient(ellipse 35% 60% at 0% 100%, rgba(92,225,176,.1), transparent 70%),
    linear-gradient(160deg, ${n.base} 0%, ${n.deep} 100%) !important;
}
[data-mi~="ax-night"]::before {
  content: ""; position: absolute; inset: 0; pointer-events: none; border-radius: inherit;
  background-image:
    linear-gradient(rgba(188,197,230,.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(188,197,230,.08) 1px, transparent 1px),
    linear-gradient(rgba(188,197,230,.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(188,197,230,.035) 1px, transparent 1px);
  background-size: 40px 40px, 40px 40px, 8px 8px, 8px 8px;
  -webkit-mask-image: radial-gradient(ellipse 70% 90% at 70% 20%, #000 10%, transparent 75%);
  mask-image: radial-gradient(ellipse 70% 90% at 70% 20%, #000 10%, transparent 75%);
}
[data-mi~="ax-night"] > * { position: relative; }
/* Battement de l'état vide du chat (src/ui/chat/PulseMark.web.tsx). */
.medinfo-pulse { stroke-dasharray: 80; animation: ax-pulse 1400ms cubic-bezier(.45,0,.2,1) 200ms both; }
@keyframes ax-pulse { from { stroke-dashoffset: 80; } to { stroke-dashoffset: 0; } }
`;
