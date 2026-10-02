import { tokens } from './tokens';

/**
 * États d'interaction des contrôles faits main (web) — 05_DESIGN §5 et §7.
 *
 * Une COUCHE D'ÉTAT (pseudo-élément `::after`, même arrondi que le contrôle) se pose sur
 * le contrôle survolé puis appuyé. Elle fonctionne sur n'importe quel fond, sans que chaque
 * écran ait à définir sa couleur de survol, et ne modifie ni la taille ni la mise en page.
 * Les vues react-native-web sont déjà `position: relative` : la couche reste dans le contrôle.
 *
 * Consommé par `<Touchable feedback=…>` (attribut `data-tap`) et injecté dans le <head>
 * (app/+html.tsx). Pur et sans dépendance : testé dans tests/unit/interaction.test.ts.
 */
export type TapFeedback = 'layer' | 'light' | 'link' | 'none';

/**
 * Lien expo-router mis en forme de bouton (fond plein) : couche d'état au lieu du soulignement
 * (`light` sur un fond sombre). Le style du lien doit porter `position: 'relative'` : la couche
 * s'y ancre, et un <Text> n'est pas positionné par défaut.
 */
export function buttonLinkProps(tone: 'layer' | 'light' = 'layer') {
  return { dataSet: { tap: tone } };
}

/** Opacités de la couche d'état : survol puis appui (assombrissement / éclaircissement). */
export const STATE_LAYER = {
  dark: { hover: 0.05, pressed: 0.1 },
  light: { hover: 0.1, pressed: 0.18 },
} as const;

const ACTIVE = ':not([aria-disabled="true"])';
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

export const INTERACTION_CSS = `
/* ── Couche d'état des contrôles (src/ui/interaction.ts) ── */
[data-tap] { -webkit-tap-highlight-color: transparent; }
[data-tap="layer"]::after, [data-tap="light"]::after {
  content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  background-color: ${tokens.colors.text}; opacity: 0;
  transition: opacity ${tokens.motion.duration.fast}ms ${EASE};
}
[data-tap="light"]::after { background-color: ${tokens.colors.onAccent}; }
@media (hover: hover) {
  [data-tap="layer"]${ACTIVE}:hover::after { opacity: ${STATE_LAYER.dark.hover}; }
  [data-tap="light"]${ACTIVE}:hover::after { opacity: ${STATE_LAYER.light.hover}; }
  [data-tap="link"]${ACTIVE}:hover [dir="auto"] { text-decoration-line: underline; text-underline-offset: 3px; text-decoration-thickness: 1px; }
  /* Liens de navigation textuels (<Link> expo-router = vraie balise <a>) : soulignés au survol. */
  a[href]:not([data-tap]):hover { text-decoration-line: underline; text-underline-offset: 3px; text-decoration-thickness: 1px; }
}
[data-tap="layer"]${ACTIVE}:active::after { opacity: ${STATE_LAYER.dark.pressed}; }
[data-tap="light"]${ACTIVE}:active::after { opacity: ${STATE_LAYER.light.pressed}; }
[data-tap="link"]${ACTIVE}:active { opacity: 0.7; }
[data-tap][aria-disabled="true"] { cursor: not-allowed; }
/* Actions secondaires d'une ligne (renommer, supprimer…) : révélées au survol ou au focus
   clavier de la ligne à la souris ; toujours visibles au doigt (aucun survol possible).
   Repliées à largeur nulle (et non masquées) : le titre de la ligne garde toute la place, et
   les actions restent lisibles par les lecteurs d'écran et atteignables au clavier. */
@media (hover: hover) and (pointer: fine) {
  [data-mi~="reveal-host"] [data-mi~="reveal"] { opacity: 0; max-width: 0; overflow: hidden; transition: opacity ${tokens.motion.duration.fast}ms ${EASE}; }
  [data-mi~="reveal-host"]:hover [data-mi~="reveal"],
  [data-mi~="reveal-host"]:focus-within [data-mi~="reveal"] { opacity: 1; max-width: 160px; overflow: visible; }
}
`;
