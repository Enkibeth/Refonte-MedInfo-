/**
 * Outils de SORTIE optionnels du chat (2026-07) — activés par l'utilisateur.
 *
 * Contrairement aux outils serveur de la boucle agentique (Europe PMC, verifyLinks…),
 * ce ne sont PAS des appels REST : ce sont des AUGMENTATIONS de la réponse rédigée,
 * demandées via le system prompt et rendues côté client :
 *   - `diagram`    : un schéma visuel (bloc ```medinfo-diagram`, cf. src/ai/chat/diagram.ts) ;
 *   - `keypoints`  : un encadré « À retenir » en tête de réponse ;
 *   - `comparison` : une comparaison structurée en tableau markdown.
 *
 * Module PUR (server-safe, aucun appel LLM ajouté, aucune donnée de santé). Aucune
 * nouvelle feature IA admin : on ne fait qu'enrichir le system prompt de la feature `chat`.
 */
export type ChatOutputTool = 'diagram' | 'keypoints' | 'comparison';

export const CHAT_OUTPUT_TOOLS: ChatOutputTool[] = ['diagram', 'keypoints', 'comparison'];

/** Borne/valide la liste reçue du client (dédoublonnée, ordre stable, max borné). */
export function coerceChatOutputTools(value: unknown): ChatOutputTool[] {
  if (!Array.isArray(value)) return [];
  const set = new Set<ChatOutputTool>();
  for (const item of value) {
    if (CHAT_OUTPUT_TOOLS.includes(item as ChatOutputTool)) set.add(item as ChatOutputTool);
  }
  // Ordre canonique (indépendant de l'ordre d'envoi client).
  return CHAT_OUTPUT_TOOLS.filter((t) => set.has(t));
}

/**
 * Section concaténée au system prompt décrivant les augmentations demandées. Chaque
 * consigne est CONDITIONNELLE (« quand c'est pertinent ») : jamais forcer un diagramme
 * ou un tableau hors-sujet, et jamais inventer de fait/chiffre/source pour les remplir.
 * Vide si aucun outil sélectionné.
 */
export function buildOutputToolsSection(tools: ChatOutputTool[]): string {
  if (tools.length === 0) return '';

  const parts: string[] = [];

  if (tools.includes('keypoints')) {
    parts.push(
      `- POINTS CLÉS : commence ta réponse par un encadré « ## À retenir » suivi de 3 à 5 ` +
        `puces synthétiques (l'essentiel, actionnable), puis développe normalement. ` +
        `N'y mets que des éléments présents dans ta réponse, jamais un fait nouveau.`,
    );
  }

  if (tools.includes('comparison')) {
    parts.push(
      `- TABLEAU COMPARATIF : quand la question compare des options (traitements, examens, ` +
        `diagnostics…), présente la comparaison dans un tableau markdown clair (une ligne par ` +
        `option, des colonnes de critères pertinents). Si rien ne se compare, n'en mets pas.`,
    );
  }

  if (tools.includes('diagram')) {
    parts.push(
      `- DIAGRAMME : quand un schéma clarifie la réponse (algorithme de prise en charge, ` +
        `arbre décisionnel, étapes d'un mécanisme physiopathologique, frise), inclus UN bloc ` +
        `de diagramme au format EXACT suivant, à l'endroit pertinent de ta réponse :\n` +
        '```medinfo-diagram\n' +
        `{"title":"Titre court","nodes":[{"kind":"start","text":"Point de départ"},` +
        `{"kind":"decision","text":"Question / critère ?","branches":[{"label":"Oui","text":"Conséquence"},` +
        `{"label":"Non","text":"Autre voie"}]},{"kind":"step","text":"Étape"},{"kind":"end","text":"Aboutissement"}]}\n` +
        '```\n' +
        `Règles du diagramme : JSON valide sur une seule structure ; "kind" ∈ start|step|decision|end ; ` +
        `3 à 8 nœuds ; "branches" seulement pour un "decision" (2 à 3 branches) ; textes courts en ` +
        `français ; n'invente aucun seuil, chiffre ni conduite non fondés. Un seul diagramme par ` +
        `réponse, et seulement s'il apporte vraiment de la clarté.`,
    );
  }

  return (
    `\n\nAUGMENTATIONS DE RÉPONSE DEMANDÉES PAR L'UTILISATEUR\n` +
    `Applique les éléments suivants EN PLUS de tes consignes de format habituelles, ` +
    `uniquement quand ils servent réellement la clarté (jamais de remplissage) :\n` +
    `${parts.join('\n')}`
  );
}
