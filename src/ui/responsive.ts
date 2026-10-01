import { Platform } from 'react-native';

import { tokens } from './tokens';

/**
 * Mise en page par point de rupture, portée par le CSS sur le web.
 *
 * Les pages web sont pré-rendues sans fenêtre (largeur 0) : une mise en page choisie en
 * JS selon la largeur s'affichait d'abord en version compacte sur tablette et ordinateur,
 * puis sautait vers la bonne version après l'hydratation (décalage visible, CLS). Sur le
 * web, ces bascules sont donc aussi écrites en CSS, rattachées à un attribut `data-mi` :
 * le premier affichage est juste à toutes les largeurs, et le rendu JS qui suit
 * l'hydratation applique les mêmes valeurs. Sur natif, le JS reste seul maître.
 *
 * Règle : le style JS d'un écran pré-rendu vaut sa variante « largeur 0 » (la plus
 * compacte) ; le CSS ne corrige que les plages plus larges, avec `!important`.
 */

/** Plages de la navigation publique (LandingHeader). */
export const NAV_COMPACT_BREAKPOINT = tokens.layout.compact; // < : logo + menu + (pas de CTA)
export const NAV_WIDE_BREAKPOINT = 920; // ≥ : tous les liens à plat

/**
 * Attribut `data-mi` (web seulement) rattachant un élément aux règles ci-dessous ;
 * plusieurs noms séparés par des espaces (`[data-mi~="…"]`).
 */
export function mi(...names: string[]): {} {
  return Platform.OS === 'web' ? { dataSet: { mi: names.join(' ') } } : {};
}

const { compact, shell } = tokens.layout;
const { space, type } = tokens;
const below = (bp: number) => `@media (max-width: ${bp - 1}px)`;
const from = (bp: number) => `@media (min-width: ${bp}px)`;

/** Visibilité par plage : `mi('ge640')` = affiché à partir de 640 px, `mi('lt640')` = en dessous, etc. */
const visibility = [compact, NAV_WIDE_BREAKPOINT, shell]
  .map(
    (bp) => `${below(bp)} { [data-mi~="ge${bp}"] { display: none !important; } }
${from(bp)} { [data-mi~="lt${bp}"] { display: none !important; } }`,
  )
  .join('\n');

/** Injecté tel quel dans le <head> du document web (app/+html.tsx). */
export const RESPONSIVE_CSS = `
/* ── Mise en page de pré-rendu (src/ui/responsive.ts) ── */
${visibility}
/* « nav-mid » : seulement entre ${compact} et ${NAV_WIDE_BREAKPOINT - 1} px (lien Blog isolé de la navigation publique). */
${below(compact)} { [data-mi~="nav-mid"] { display: none !important; } }
${from(NAV_WIDE_BREAKPOINT)} { [data-mi~="nav-mid"] { display: none !important; } }

/* En-tête du chat : colonne sous ${compact} px (variante pré-rendue), ligne au-delà. */
${from(compact)} {
  [data-mi~="chat-header"] { flex-direction: row !important; align-items: center !important; }
  [data-mi~="chat-header-actions"] { justify-content: flex-start !important; }
}

/* Accueil (app/index.tsx) : mêmes valeurs que les styles JS non compacts / larges. */
${from(compact)} {
  [data-mi~="landing-container"] { padding-left: ${space.xl}px !important; padding-right: ${space.xl}px !important; }
  [data-mi~="landing-actions"] { flex-direction: row !important; }
  [data-mi~="landing-actions"] > * { align-self: auto !important; width: auto !important; }
}
${from(shell)} {
  [data-mi~="landing-hero"] { flex-direction: row !important; padding-top: ${space['4xl']}px !important; padding-bottom: ${space['4xl']}px !important; row-gap: ${space['4xl']}px !important; column-gap: ${space['4xl']}px !important; }
  [data-mi~="landing-headline"] { font-size: ${type.landing.fontSize}px !important; line-height: ${type.landing.lineHeight}px !important; letter-spacing: ${type.landing.letterSpacing}px !important; }
  [data-mi~="landing-hero-photo"] { flex-grow: 1 !important; flex-shrink: 1 !important; flex-basis: 0% !important; max-width: ${tokens.layout.form}px !important; align-self: center !important; }
  [data-mi~="landing-photo-image"] > :first-child { aspect-ratio: 3 / 2 !important; }
  [data-mi~="landing-audiences"] { flex-direction: row !important; row-gap: ${space.lg}px !important; column-gap: ${space.lg}px !important; }
  [data-mi~="landing-audience"] { flex-grow: 1 !important; flex-shrink: 1 !important; flex-basis: 0% !important; }
  [data-mi~="landing-tools-intro"] { flex-direction: row !important; align-items: center !important; row-gap: ${space['4xl']}px !important; column-gap: ${space['4xl']}px !important; }
  [data-mi~="landing-tools-photo"] { flex-grow: 1 !important; flex-shrink: 1 !important; flex-basis: 0% !important; max-width: ${tokens.layout.audience}px !important; }
  [data-mi~="landing-tools"] { flex-direction: row !important; flex-wrap: wrap !important; column-gap: ${space['2xl']}px !important; }
  [data-mi~="landing-tool"] { width: 48% !important; }
  [data-mi~="landing-trust"] { flex-direction: row !important; row-gap: ${space['4xl']}px !important; column-gap: ${space['4xl']}px !important; }
  [data-mi~="landing-faq"] { flex-direction: row !important; column-gap: ${space['3xl']}px !important; }
  [data-mi~="landing-faq-question"] { flex: 1 !important; }
  [data-mi~="landing-faq-answer"] { flex: 2 !important; }
}
`;
