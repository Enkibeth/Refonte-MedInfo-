import { useEffect, useState, useSyncExternalStore, type Dispatch, type SetStateAction } from 'react';

/**
 * Hydratation de l'export web statique.
 *
 * Le pré-rendu ne connaît ni le stockage local ni les capacités du navigateur : un état
 * initialisé depuis `localStorage` (ou une détection navigateur) au premier rendu donnait
 * un HTML différent de celui du pré-rendu. React levait alors l'erreur #418, jetait le
 * HTML pré-rendu et reconstruisait tout l'arbre.
 *
 * `useSyncExternalStore` renvoie la valeur « serveur » pendant le pré-rendu ET pendant
 * l'hydratation de CE composant (y compris derrière une frontière Suspense hydratée plus
 * tard), puis la valeur cliente. Hors web, il n'y a jamais d'hydratation.
 */
const subscribeNever = () => () => {};
const notHydrating = () => false;
const hydrating = () => true;

function useIsHydrating(): boolean {
  return useSyncExternalStore(subscribeNever, notHydrating, hydrating);
}

/**
 * État initialisé côté client (préférence stockée, détection navigateur…) : lu dès le
 * premier rendu quand le composant monte hors hydratation (navigation interne), sinon
 * juste après le montage. `ready` devient vrai quand la valeur lue est en place : une
 * persistance doit l'attendre, sinon la valeur par défaut écraserait la préférence.
 */
export function useClientState<T>(read: () => T, fallback: T): [T, Dispatch<SetStateAction<T>>, boolean] {
  const isHydrating = useIsHydrating();
  const [value, setValue] = useState<T>(() => (isHydrating ? fallback : read()));
  const [ready, setReady] = useState(!isHydrating);
  useEffect(() => {
    if (ready) return;
    setValue(read());
    setReady(true);
    // Lecture unique au montage : `read` n'est pas une dépendance réactive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return [value, setValue, ready];
}
