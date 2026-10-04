import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';
import { CHIP_CSS } from '@/ui/Chip';
import { INTERACTION_CSS } from '@/ui/interaction';
import { SKIP_LINK_CSS } from '@/ui/landmarks';
import { SESSION_HINT_CSS, SESSION_HINT_SCRIPT } from '@/ui/sessionHint';
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
// Polices AUTO-HÉBERGÉES (public/vendor/fonts, sous-ensemble latin des fichiers variables
// Google Fonts, licence SIL OFL — cf. public/vendor/README.md ; mêmes fichiers que les pages
// autonomes pour Source Serif 4 et JetBrains Mono). PageSpeed 2026-10 : la feuille Google
// Fonts bloquait le rendu (~2,7 s) puis la bascule de police repoussait le LCP à 4,4 s
// (1,7 s sans). Même origine + préchargement des deux polices du haut de l'accueil = plus de
// chaîne googleapis → gstatic. `swap` : le texte s'affiche aussitôt en police système.
const LATIN_RANGE =
  'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const FONT_FACES: { family: string; file: string; weight: string; style?: 'italic' }[] = [
  { family: 'Inter', file: 'Inter-latin.woff2', weight: '400 700' },
  { family: 'Schibsted Grotesk', file: 'SchibstedGrotesk-latin.woff2', weight: '400 700' },
  { family: 'Source Serif 4', file: 'SourceSerif4-normal.woff2', weight: '200 900' },
  // Vrai italique (accroche « Revenir aux sources. ») : sans lui, le navigateur penchait le romain.
  { family: 'Source Serif 4', file: 'SourceSerif4-italic.woff2', weight: '200 900', style: 'italic' },
  { family: 'JetBrains Mono', file: 'JetBrainsMono-480c0625.woff2', weight: '400 600' },
];
/** Préchargées : texte courant (Inter) et grand titre de l'accueil (Source Serif 4). */
const PRELOADED_FONTS = ['Inter-latin.woff2', 'SourceSerif4-normal.woff2'];
const fontFaceCss = FONT_FACES.map(
  (f) =>
    `@font-face{font-family:'${f.family}';font-style:${f.style ?? 'normal'};font-weight:${f.weight};font-display:swap;src:url(/vendor/fonts/${f.file}) format('woff2');unicode-range:${LATIN_RANGE};}`,
).join('\n');

/**
 * Polices de SECOURS aux dimensions des polices web (anti-CLS, PageSpeed 2026-10 : la bascule
 * Georgia → Source Serif 4 du grand titre changeait ses retours à la ligne et poussait les
 * boutons, CLS 0,18). Une police système (Times New Roman / Arial, ou leurs clones
 * métriques Liberation) est mise à l'échelle pour occuper la même largeur et la même hauteur
 * de ligne : la bascule ne déplace plus rien. Valeurs MESURÉES avec fontTools sur le texte du
 * haut de l'accueil (largeur cumulée des glyphes ; Source Serif 4 au corps optique du titre
 * mobile 40 px) — à recalculer si les polices changent.
 */
const fallbackFaceCss = [
  "@font-face{font-family:'Source Serif 4 Fallback';src:local('Times New Roman'),local('TimesNewRomanPSMT'),local('Liberation Serif'),local('Tinos');size-adjust:107%;ascent-override:96.8%;descent-override:31.3%;line-gap-override:0%;}",
  "@font-face{font-family:'Inter Fallback';src:local('Arial'),local('ArialMT'),local('Liberation Sans'),local('Arimo');size-adjust:106.9%;ascent-override:90.6%;descent-override:22.6%;line-gap-override:0%;}",
].join('\n');

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, shrink-to-fit=no" />
        {/* Blanc, comme l'en-tête du site et la barre compacte : un aplat bleu vif au-dessus d'un
            en-tête blanc créait une rupture dans la barre d'adresse mobile et l'app installée. */}
        <meta name="theme-color" content={tokens.colors.surface} />
        {/* Thème clair uniquement : sans cette déclaration, le mode sombre du système
            assombrit les champs et barres de défilement natifs sur un fond ivoire. */}
        <meta name="color-scheme" content="light" />
        {/* Installation (PWA) et icône d'écran d'accueil iOS — public/manifest.webmanifest. */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />

        {PRELOADED_FONTS.map((file) => (
          <link key={file} rel="preload" as="font" type="font/woff2" href={`/vendor/fonts/${file}`} crossOrigin="anonymous" />
        ))}
        <style dangerouslySetInnerHTML={{ __html: `${fontFaceCss}\n${fallbackFaceCss}` }} />

        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: baseStyle }} />
        {/* Avant le premier affichage : « ce navigateur avait une session » (src/ui/sessionHint.ts). */}
        <script dangerouslySetInnerHTML={{ __html: SESSION_HINT_SCRIPT }} />
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
   recouvre plus le contenu → le bas des écrans (saisie du chat) reste entièrement visible.
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

/* Coupures de ligne (2026-10) : titres équilibrés, paragraphes sans mot orphelin.
   Propriété longue text-wrap-style : le raccourci text-wrap écraserait le white-space:nowrap
   que react-native-web pose pour numberOfLines. Ignorée sans dommage par les navigateurs
   qui ne la connaissent pas. */
h1, h2, h3, h4, [role="heading"] { text-wrap-style: balance; }
p, [dir="auto"] { text-wrap-style: pretty; }
/* Safari iOS agrandit la page au focus d'un champ de moins de 16 px (et la laisse agrandie) :
   16 px minimum au doigt, sur tous les champs de l'application. Le zoom n'est jamais bloqué. */
@media (pointer: coarse) {
  input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]), textarea, select { font-size: 16px !important; }
}

/* Tracé ECG (accueil + hero du dashboard) : la ligne se dessine, tient, puis s'efface et
   recommence — battement lent (cycle 9 s), discret. La réinitialisation du tracé a lieu
   pendant que la ligne est invisible. Retiré par erreur à la refonte 2026-09, rétabli. */
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

${RESPONSIVE_CSS}
${INTERACTION_CSS}
${CHIP_CSS}
${SKIP_LINK_CSS}
${SESSION_HINT_CSS}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
  .medinfo-ecg-path { animation: none !important; stroke-dasharray: none; }
}
`;
