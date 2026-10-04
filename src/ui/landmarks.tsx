/**
 * Repères de navigation (landmarks) et lien d'évitement — accessibilité WCAG 2.4.1.
 *
 * Audit axe 2026-10 : aucune page n'exposait de `<main>`, `<nav>`, `<header>` ni `<footer>`
 * (508 nœuds hors repère sur 25 écrans). Un lecteur d'écran ne pouvait pas sauter au
 * contenu, ni un utilisateur clavier éviter la navigation à chaque page.
 *
 * Structure retenue (un seul `<main>` VISIBLE par écran) :
 *   - pages publiques : `LandingHeader` (`banner` + `navigation`), `<MainContent>` autour du
 *     contenu, `SiteFooter` (`contentinfo`) — en-tête et pied restent HORS du `<main>` ;
 *   - espace connecté : chaque écran des groupes applicatifs est enveloppé par
 *     `screenMainLayout` (option `screenLayout` des navigateurs) ; barre latérale du shell
 *     = `navigation`, barre supérieure du shell = `banner` ; la barre compacte mobile est
 *     dans le `<main>` de l'écran (comme celle du chat), sans rôle de repère.
 * Les écrans d'onglets déjà visités restent montés mais masqués (`display: none`) : leurs
 * `<main>` sont absents de l'arbre d'accessibilité. Seul l'écran au premier plan porte
 * l'identifiant cible (`#contenu`, jamais dupliqué) ; le lien d'évitement donne de toute façon
 * le focus au `<main>` réellement affiché.
 */
import type { ReactNode } from 'react';
import { Platform, StyleSheet, Text, View, type ViewProps } from 'react-native';
import { useIsFocused } from 'expo-router';

import { mi } from './responsive';
import { tokens } from './tokens';

/** Cible du lien d'évitement : portée par le `<main>` de l'écran affiché, et lui seul. */
export const MAIN_CONTENT_ID = 'contenu';

/** Zone de contenu principal d'un écran (`<main>` sur le web), cible du lien d'évitement. */
export function MainContent({
  children,
  nativeID = MAIN_CONTENT_ID,
  ...props
}: ViewProps & { children?: ReactNode }) {
  return (
    <View
      {...props}
      nativeID={nativeID}
      role="main"
      // Focalisable par programme (lien d'évitement), jamais dans l'ordre de tabulation.
      {...(Platform.OS === 'web' ? { tabIndex: -1 as const } : null)}
    >
      {children}
    </View>
  );
}

/** Écran d'un navigateur : identifiant de cible réservé à l'écran au premier plan. */
function ScreenMain({ children }: { children: ReactNode }) {
  const focused = useIsFocused();
  return (
    <MainContent style={styles.fill} nativeID={focused ? MAIN_CONTENT_ID : undefined}>
      {children}
    </MainContent>
  );
}

/** `screenLayout` des navigateurs de l'espace connecté : chaque écran dans un `<main>`. */
export function screenMainLayout({ children }: { children: ReactNode }) {
  return <ScreenMain>{children}</ScreenMain>;
}

/** Premier `<main>` réellement affiché (les onglets masqués gardent le leur). */
function focusVisibleMain() {
  if (typeof document === 'undefined') return;
  const target = Array.from(document.querySelectorAll<HTMLElement>('main')).find(
    (node) => node.getClientRects().length > 0,
  );
  if (!target) return;
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: false });
}

/**
 * « Aller au contenu » : premier élément tabulable de chaque page, invisible tant qu'il n'a
 * pas le focus clavier (règle CSS `[data-mi~="skip-link"]`, app/+html.tsx). Web seulement.
 */
export function SkipLink() {
  if (Platform.OS !== 'web') return null;
  return (
    <Text
      // `href` (react-native-web) → rendu en <a> ; sans JavaScript, l'ancre reste inoffensive.
      {...({ href: `#${MAIN_CONTENT_ID}` } as object)}
      {...mi('skip-link')}
      role="link"
      onPress={(event) => {
        event.preventDefault();
        focusVisibleMain();
      }}
      style={styles.skip}
    >
      Aller au contenu principal
    </Text>
  );
}

/** Règles CSS du lien d'évitement (injectées par app/+html.tsx). */
export const SKIP_LINK_CSS = `
[data-mi~="skip-link"] { position: fixed !important; top: ${tokens.space.sm}px; left: ${tokens.space.sm}px; z-index: 10000; transform: translateY(-200%); }
[data-mi~="skip-link"]:focus, [data-mi~="skip-link"]:focus-visible { transform: none; }
main:focus { outline: none; }
`;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  skip: {
    backgroundColor: tokens.colors.text,
    color: tokens.colors.surface,
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
    borderRadius: tokens.radius.md,
    textDecorationLine: 'none',
  },
});
