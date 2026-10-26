import { LANDING_CSS } from './landingCss';

/**
 * Feuille de l'accueil (web) : rendue dans la page, donc présente dans le HTML pré-rendu
 * (premier affichage juste, sans saut) et absente des autres pages. Contenu constant :
 * identique au pré-rendu et au client.
 */
export function LandingStyle() {
  return <style dangerouslySetInnerHTML={{ __html: LANDING_CSS }} />;
}
