/**
 * Liens de navigation rendus en VRAIS liens sur le web (`<a href>`), sans perdre la navigation
 * côté client.
 *
 * Les entrées de menu étaient des `Pressable` « role=link » sans `href` : ni clic du milieu,
 * ni « ouvrir dans un nouvel onglet », ni lien lisible par les robots. `<Link asChild>`
 * d'expo-router ne convient pas ici : le gestionnaire de clic de `Pressable` remplace celui du
 * lien, et le navigateur suivait alors l'adresse en rechargeant toute l'application.
 *
 * `navLinkProps(route, go)` pose `href` (adresse publique, groupes retirés) et un `onPress`
 * qui navigue côté client — sauf clic modifié (Ctrl/Cmd/Maj, bouton du milieu), laissé au
 * navigateur pour ouvrir un nouvel onglet ou une nouvelle fenêtre.
 */
import { Platform } from 'react-native';

import { isModifiedClick, publicHref, type ClickLike } from './navHref';

/**
 * Props d'un `Pressable`/`Touchable` de navigation : `href` sur le web + navigation client.
 * @param go navigation applicative (ex. `() => router.push(route)`), appelée hors clic modifié
 */
export function navLinkProps(route: string, go: () => void): { onPress: (event: unknown) => void } {
  const onPress = (event: unknown) => {
    const click = event as ClickLike | undefined;
    if (Platform.OS === 'web') {
      if (isModifiedClick(click)) return;
      click?.preventDefault?.();
    }
    go();
  };
  return Platform.OS === 'web' ? ({ href: publicHref(route), onPress } as { onPress: typeof onPress }) : { onPress };
}
