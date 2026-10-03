/**
 * Partie PURE des liens de navigation (src/ui/navLink.ts) — sans React Native, testée dans
 * tests/unit/nav-link.test.ts.
 */

/** Adresse publique d'une route expo-router : groupes `(x)` retirés, requête conservée. */
export function publicHref(route: string): string {
  const [path, query] = route.split('?');
  const clean = path.replace(/\/\([^/)]+\)/g, '').replace(/\/+$/, '') || '/';
  return query ? `${clean}?${query}` : clean;
}

export type ClickLike = {
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  button?: number;
  preventDefault?: () => void;
};

/** Clic que le navigateur doit traiter lui-même (nouvel onglet / nouvelle fenêtre). */
export function isModifiedClick(event: ClickLike | null | undefined): boolean {
  return Boolean(event && (event.metaKey || event.ctrlKey || event.shiftKey || (event.button ?? 0) !== 0));
}
