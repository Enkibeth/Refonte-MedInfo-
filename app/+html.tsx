import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Document HTML racine (web uniquement, expo-router).
 * - Charge Inter + JetBrains Mono (typographie « dessinée », cf 05_DESIGN §3).
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
        <meta name="theme-color" content="#2563EB" />

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=DM+Sans:opsz,wght@9..40,500;9..40,600;9..40,700&family=Source+Serif+4:opsz,wght@8..60,500;8..60,600;8..60,700&family=JetBrains+Mono:wght@400;500&display=swap"
        />

        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: baseStyle }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const baseStyle = `
html, body { background-color: #F7F9FC; }
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
::selection { background-color: rgba(37, 99, 235, 0.16); }

/* Barre de défilement fine et neutre : signe d'attention au détail, jamais criarde. */
* { scrollbar-width: thin; scrollbar-color: #C3CDDB transparent; }
*::-webkit-scrollbar { width: 8px; height: 8px; }
*::-webkit-scrollbar-track { background: transparent; }
*::-webkit-scrollbar-thumb { background-color: #C3CDDB; border-radius: 999px; }
*::-webkit-scrollbar-thumb:hover { background-color: #5D6B80; }

/* Mouvement (design system §4). Courbes partagées avec tokens.motion.easing.
   L'entrée par défaut : fade + remontée 8 px, easing « standard ». */
@keyframes medinfo-reveal {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.medinfo-reveal {
  animation: medinfo-reveal 460ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

/* Tracé ECG du hero : la ligne se dessine, tient, puis s'efface et recommence —
   battement lent (cycle 9 s), assez discret pour ne jamais voler le premier rôle.
   La réinitialisation du tracé se fait pendant que la ligne est invisible. */
@keyframes medinfo-ecg-draw {
  0%   { stroke-dashoffset: 1700; opacity: 1; }
  30%  { stroke-dashoffset: 0; opacity: 1; }
  80%  { stroke-dashoffset: 0; opacity: 1; }
  90%  { stroke-dashoffset: 0; opacity: 0; }
  100% { stroke-dashoffset: 0; opacity: 0; }
}
.medinfo-ecg-path {
  stroke-dasharray: 1700;
  animation: medinfo-ecg-draw 9000ms cubic-bezier(0.4, 0, 0.2, 1) 300ms infinite;
}

/* Shimmer de chargement (squelettes) : balayage discret gauche → droite. */
@keyframes medinfo-shimmer {
  from { background-position: -200% 0; }
  to   { background-position: 200% 0; }
}
.medinfo-shimmer {
  background-image: linear-gradient(90deg, rgba(222,227,232,0) 0%, rgba(222,227,232,0.7) 50%, rgba(222,227,232,0) 100%);
  background-size: 200% 100%;
  animation: medinfo-shimmer 1600ms linear infinite;
}

/* Respect strict de prefers-reduced-motion : on neutralise toute animation/transition. */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
  .medinfo-reveal { animation: none !important; }
  .medinfo-ecg-path { animation: none !important; stroke-dasharray: none; }
  .medinfo-shimmer { animation: none !important; }
}
`;
