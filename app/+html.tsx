import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';
import { RESPONSIVE_CSS } from '@/ui/responsive';
import { tokens } from '@/ui/tokens';

/**
 * Document HTML racine (web uniquement, expo-router).
 * - Charge Inter (corps) + Schibsted Grotesk (titres UI/display, grotesk éditoriale
 *   open-source issue de Free Faces — remplace le DM Sans « générique » 2026-07) +
 *   Source Serif 4 (titres de page) + JetBrains Mono (cf 05_DESIGN §3).
 * - Active le lissage des polices et un rendu net (anti-aliasing) pour éviter
 *   l'aspect générique « système brut ».
 * Ce fichier ne s'exécute pas sur natif ; n'y mettre aucune logique applicative.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, shrink-to-fit=no" />
        <meta name="theme-color" content={tokens.colors.accentVivid} />

        <link rel="stylesheet" href="/vendor/fonts/fonts.css" />

        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: baseStyle }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const baseStyle = `
:focus-visible { outline: ${tokens.border.thin * 2}px solid ${tokens.colors.accent}; outline-offset: ${tokens.border.accent}px; }
input, textarea, select { accent-color: ${tokens.colors.accent}; }
@media (pointer: fine) {
  [data-testid="assistant-message"] [data-testid="response-actions"] { opacity: 0; }
  [data-testid="assistant-message"]:hover [data-testid="response-actions"],
  [data-testid="assistant-message"]:focus-within [data-testid="response-actions"] { opacity: 1; }
}

html, body { background-color: ${tokens.colors.background}; }
/* Hauteur dynamique (dvh) : sur Safari mobile, la barre d'outils du navigateur ne
   recouvre plus le contenu → la barre d'onglets du bas reste entièrement visible.
   overflow-x masqué : un token très long (URL) ne crée plus de défilement horizontal
   qui décalait le header (bouton « Sources » coupé). */
html, body, #root { height: 100%; }
#root { display: flex; flex-direction: column; min-height: 100dvh; }
body { overflow-x: hidden; }
* {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}
::selection { background-color: ${tokens.colors.accentSurfaceStrong}; }

/* Barre de défilement fine et neutre : signe d'attention au détail, jamais criarde. */
* { scrollbar-width: thin; scrollbar-color: ${tokens.colors.borderStrong} transparent; }
*::-webkit-scrollbar { width: 8px; height: 8px; }
*::-webkit-scrollbar-track { background: transparent; }
*::-webkit-scrollbar-thumb { background-color: ${tokens.colors.borderStrong}; border-radius: 999px; }
*::-webkit-scrollbar-thumb:hover { background-color: ${tokens.colors.textMuted}; }

/* Mouvement (design system §4). Courbes partagées avec tokens.motion.easing.
   L'entrée par défaut : fade + remontée 8 px, easing « standard ». */
@keyframes medinfo-reveal {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.medinfo-reveal {
  animation: medinfo-reveal ${tokens.motion.duration.base}ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
${RESPONSIVE_CSS}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
  .medinfo-reveal { animation: none !important; }
  .medinfo-ecg-path { animation: none !important; stroke-dasharray: none; }
  .medinfo-hero-glow { animation: none !important; transform: none !important; }
  .medinfo-shimmer { animation: none !important; }
}
`;
