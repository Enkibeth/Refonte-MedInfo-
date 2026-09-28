import { useSyncExternalStore } from 'react';
import { Dimensions, Platform } from 'react-native';

/**
 * Largeur de fenêtre compatible avec l'hydratation de l'export web statique.
 *
 * Les pages web sont pré-rendues sans fenêtre : largeur 0, donc mise en page compacte.
 * `useWindowDimensions` renvoyait la vraie largeur dès le premier rendu client ; sur
 * tablette et ordinateur, React constatait un HTML différent (erreur #418), jetait le
 * HTML pré-rendu et reconstruisait tout l'arbre. Ici l'hydratation reprend la valeur du
 * pré-rendu, puis React re-rend aussitôt avec la vraie largeur. Les écrans montés après
 * l'hydratation (navigation interne) lisent directement la vraie largeur.
 */
const subscribe = (onChange: () => void) => {
  const subscription = Dimensions.addEventListener('change', onChange);
  return () => subscription.remove();
};

const windowWidth = () => Dimensions.get('window').width;

/** Largeur utilisée par le pré-rendu statique (aucune fenêtre côté serveur). */
const PRERENDER_WIDTH = 0;
const prerenderWidth = () => PRERENDER_WIDTH;

export function useWindowWidth(): number {
  return useSyncExternalStore(subscribe, windowWidth, Platform.OS === 'web' ? prerenderWidth : windowWidth);
}
