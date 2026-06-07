/**
 * Marqueurs et parsing du bloc « Auto-réflexion » émis en fin de réponse du chat.
 *
 * Le modèle termine chaque réponse substantielle par un bloc encadré par
 * ⟦REFLEXION⟧ … ⟦/REFLEXION⟧ (même style maison que ⟦SOURCE_DATA⟧). Côté UI ce bloc
 * est extrait du corps de la réponse et rendu dans une carte dédiée (ReflectionCard),
 * jamais mélangé au texte principal.
 *
 * Module pur (aucun import natif) : utilisable client ET serveur.
 */
export const REFLECTION_OPEN = '⟦REFLEXION⟧';
export const REFLECTION_CLOSE = '⟦/REFLEXION⟧';

export interface SplitReflection {
  /** Corps de la réponse, débarrassé du bloc d'auto-réflexion (et de ses marqueurs). */
  body: string;
  /** Contenu de l'auto-réflexion, ou null si absent. */
  reflection: string | null;
  /** True tant que le bloc est ouvert mais pas encore fermé (utile pendant le streaming). */
  streaming: boolean;
}

/**
 * Sépare le corps de la réponse de son bloc d'auto-réflexion.
 * Tolérant au streaming : si le marqueur d'ouverture est présent sans fermeture, tout ce
 * qui suit l'ouverture est considéré comme une auto-réflexion en cours (on n'affiche jamais
 * les marqueurs bruts à l'utilisateur).
 */
export function splitReflection(text: string): SplitReflection {
  const openIdx = text.indexOf(REFLECTION_OPEN);
  if (openIdx === -1) {
    return { body: text, reflection: null, streaming: false };
  }

  const body = text.slice(0, openIdx).trimEnd();
  const afterOpen = text.slice(openIdx + REFLECTION_OPEN.length);
  const closeIdx = afterOpen.indexOf(REFLECTION_CLOSE);

  if (closeIdx === -1) {
    // Bloc encore en cours de génération (close non reçu).
    return { body, reflection: afterOpen.trim() || null, streaming: true };
  }

  return {
    body,
    reflection: afterOpen.slice(0, closeIdx).trim() || null,
    streaming: false,
  };
}
