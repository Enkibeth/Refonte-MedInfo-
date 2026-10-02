import { forwardRef, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type View,
  type ViewStyle,
} from 'react-native';

import { type TapFeedback } from './interaction';

/**
 * Contrôle « fait main » — remplace `TouchableOpacity` dans toute l'application (05_DESIGN §5).
 *
 * `TouchableOpacity` faisait flasher le contrôle à 20 % d'opacité à chaque clic, sans aucun
 * survol ni retour d'appui lisible sur le web : le geste le plus fréquent de l'interface avait
 * l'air d'un prototype. Ici, sur le web, une COUCHE D'ÉTAT posée en CSS (`INTERACTION_CSS`,
 * src/ui/interaction.ts) assombrit très légèrement le contrôle au survol puis à l'appui, en
 * épousant son arrondi — quel que soit son fond (blanc, teinté, bleu, transparent). Pas de
 * changement de taille, pas de rebond, coupée sous `prefers-reduced-motion` comme le reste.
 *
 * `feedback` :
 *  - `layer` (défaut) : couche sombre — boutons, puces, lignes de liste ;
 *  - `light` : couche claire — contrôles posés sur un fond sombre (bleu nuit, bleu vif) ;
 *  - `link` : lien textuel — souligné au survol, aucune couche (un rectangle gris collé au
 *    texte faisait « bug ») ;
 *  - `none` : le composant gère lui-même ses états.
 * Natif : l'appui atténue le contrôle (`activeOpacity`, 0,7 par défaut — 0,2 était brutal).
 *
 * API compatible avec `TouchableOpacity` (style statique, `activeOpacity`, `disabled`…).
 */
export interface TouchableProps extends Omit<PressableProps, 'style' | 'children'> {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  /** Opacité à l'appui sur natif (le web utilise la couche d'état). */
  activeOpacity?: number;
  feedback?: TapFeedback;
  /** Attributs `data-*` (web), fusionnés avec celui de la couche d'état. */
  dataSet?: Record<string, string>;
}

const IS_WEB = Platform.OS === 'web';

export const Touchable = forwardRef<View, TouchableProps>(function Touchable(
  { style, children, activeOpacity = 0.7, feedback = 'layer', dataSet, disabled, ...rest },
  ref,
) {
  const webProps = IS_WEB ? { dataSet: { ...dataSet, tap: feedback } } : dataSet ? { dataSet } : {};
  return (
    <Pressable
      ref={ref}
      disabled={disabled}
      {...rest}
      {...webProps}
      style={({ pressed }) => [
        IS_WEB && styles.web,
        style,
        !IS_WEB && pressed && !disabled ? { opacity: activeOpacity } : null,
      ]}
    >
      {children}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  // Un double-clic sur un bouton ne sélectionne plus son libellé.
  web: { userSelect: 'none' } as ViewStyle,
});
