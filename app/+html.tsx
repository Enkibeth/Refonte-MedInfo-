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
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content="#0A4D68" />

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=DM+Sans:opsz,wght@9..40,500;9..40,600;9..40,700&family=JetBrains+Mono:wght@400;500&display=swap"
        />

        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: baseStyle }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const baseStyle = `
html, body { background-color: #FAFBFC; }
* {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}
::selection { background-color: rgba(10, 77, 104, 0.16); }

/* Mouvement (design system §4). Courbes partagées avec tokens.motion.easing.
   L'entrée par défaut : fade + remontée 8 px, easing « standard ». */
@keyframes medinfo-reveal {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.medinfo-reveal {
  animation: medinfo-reveal 460ms cubic-bezier(0.16, 1, 0.3, 1) both;
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
}
`;
