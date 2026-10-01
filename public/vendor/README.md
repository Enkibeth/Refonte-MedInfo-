# Librairies & polices auto-hébergées (F11 — audit UX 2026-07)

Ces fichiers étaient auparavant chargés depuis des CDN (jsdelivr, cdnjs, Google
Fonts). Les outils autonomes (`public/partiel.html`, `presentation.html`,
`cv-builder.html`, `article.html`) les servent désormais en local, pour qu'ils
fonctionnent même sur un réseau qui bloque les CDN (réseaux hospitaliers, mode
hors-ligne, CSP stricte).

## `js/` — versions figées
| Fichier | Lib | Version | Source d'origine |
|---|---|---|---|
| `pptxgen.bundle.js` | PptxGenJS | 3.12.0 | cdn.jsdelivr.net/npm/pptxgenjs |
| `html2canvas.min.js` | html2canvas | 1.4.1 | cdnjs |
| `jspdf.umd.min.js` | jsPDF | 2.5.1 | cdnjs |
| `mammoth.browser.min.js` | mammoth | 1.6.0 | cdnjs |
| `pdf.min.js` + `pdf.worker.min.js` | pdf.js | 3.11.174 | cdnjs |
| `xlsx.full.min.js` | SheetJS xlsx | 0.18.5 | cdnjs |

## `fonts/` — sous-ensemble latin
`fonts.css` + 5 `.woff2` (Source Serif 4, Public Sans, JetBrains Mono), plus
`Inter-latin.woff2` et `SchibstedGrotesk-latin.woff2` (polices variables) déclarées par
`app/+html.tsx` pour l'application elle-même (2026-10 : fin de la dépendance Google Fonts,
qui bloquait le premier affichage). Toutes sous licence SIL Open Font License 1.1. Sous-ensemble
**latin** uniquement (couvre les accents français) pour rester léger. Généré
depuis `fonts.googleapis.com/css2`. Repli système conservé dans les CSS des
outils (`Georgia`, `system-ui`, `ui-monospace`).

## Mise à jour
⚠️ `fonts/` est servi en cache **immuable 1 an** (`server/lib/static.mjs`) : une police mise
à jour doit prendre un **nouveau nom de fichier** (sinon les navigateurs gardent l'ancienne).

Re-télécharger depuis la même source à la version voulue et remplacer le fichier
(les chemins référencés sont `/vendor/js/…` et `/vendor/fonts/fonts.css`).
