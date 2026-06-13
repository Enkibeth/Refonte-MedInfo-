/**
 * Illustrations du chat (2026-06) : les 3 chatbots peuvent insérer des images
 * d'illustration trouvées via Google (Programmable Search Engine, searchType=image).
 *
 * Principe (même famille que <!--CALC:…-->) : le modèle émet un marqueur
 * `<!--IMG: requête de recherche | légende -->` dans sa réponse ; le client le
 * résout via la route proxy `/api/image-search` (la clé Google reste serveur),
 * puis affiche l'image avec sa légende et le domaine d'origine en crédit.
 *
 * Ce module regroupe les helpers PURS (validation de requête, sélection du
 * meilleur résultat) testés dans tests/unit/image-search.test.ts, ainsi que la
 * section de prompt ajoutée côté serveur UNIQUEMENT quand la recherche d'images
 * est configurée (sans clé, le modèle ne reçoit jamais l'instruction et
 * n'émet donc pas de marqueur).
 *
 * Configuration (Vercel / .env) :
 *   - GOOGLE_SEARCH_API_KEY     : clé API Google Cloud avec « Custom Search API » activée
 *   - GOOGLE_SEARCH_ENGINE_ID   : identifiant cx d'un Programmable Search Engine
 *                                 (recherche d'images activée, tout le web)
 */

export interface IllustrationImage {
  /** URL https de l'image en taille réelle. */
  url: string;
  /** Vignette hébergée par Google (gstatic) — repli si l'image bloque le hotlink. */
  thumbnailUrl: string | null;
  title: string | null;
  /** Page d'origine de l'image (créditée sous l'image, jamais ouverte automatiquement). */
  contextUrl: string | null;
  width: number | null;
  height: number | null;
}

/** Borne et nettoie la requête reçue du client (anti-abus, quota Google limité). */
export function normalizeImageQuery(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const query = raw.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, 160);
  return query.length >= 3 ? query : null;
}

/**
 * Sélectionne la meilleure image dans une réponse Google Custom Search
 * (`searchType=image`) : première image https d'au moins 200px de large.
 */
export function pickImageResult(payload: unknown): IllustrationImage | null {
  const items = (payload as { items?: unknown[] } | null)?.items;
  if (!Array.isArray(items)) return null;

  for (const raw of items) {
    const item = raw as {
      link?: unknown;
      title?: unknown;
      image?: { contextLink?: unknown; thumbnailLink?: unknown; width?: unknown; height?: unknown };
    };
    const url = typeof item.link === 'string' && item.link.startsWith('https://') ? item.link : null;
    if (!url) continue;
    const width = typeof item.image?.width === 'number' ? item.image.width : null;
    const height = typeof item.image?.height === 'number' ? item.image.height : null;
    // Écarte les vignettes minuscules (icônes, favicons…).
    if (width != null && width < 200) continue;

    return {
      url,
      thumbnailUrl:
        typeof item.image?.thumbnailLink === 'string' && item.image.thumbnailLink.startsWith('https://')
          ? item.image.thumbnailLink
          : null,
      title: typeof item.title === 'string' ? item.title : null,
      contextUrl: typeof item.image?.contextLink === 'string' ? item.image.contextLink : null,
      width,
      height,
    };
  }
  return null;
}

/** La recherche d'images est active seulement si la clé ET le cx sont posés côté serveur. */
export function isImageSearchConfigured(): boolean {
  return Boolean(process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID);
}

/**
 * Section « ILLUSTRATIONS » concaténée au prompt système des 3 chatbots
 * (app/api/chat+api.ts), UNIQUEMENT quand la recherche d'images est configurée.
 * Vide sinon : le modèle n'émet alors jamais de marqueur IMG.
 */
export function buildIllustrationSection(): string {
  if (!isImageSearchConfigured()) return '';
  return (
    `\n\nILLUSTRATIONS (IMAGES)\n` +
    `Tu peux illustrer ta réponse avec une image trouvée sur internet quand un visuel aide ` +
    `réellement la compréhension : schéma anatomique, mécanisme physiopathologique, geste de ` +
    `premiers secours, exemple visuel (aliment, matériel, posture).\n` +
    `- Insère le marqueur SEUL sur sa ligne, juste après le paragraphe concerné :\n` +
    `  <!--IMG: requête de recherche d'image précise | légende courte en français -->\n` +
    `- Maximum 2 images par réponse. Aucune image si le texte suffit ou si le sujet est ` +
    `sensible (santé mentale, violences, lésions choquantes, sexualité).\n` +
    `- La requête doit viser un schéma ou une illustration pédagogique (souvent plus efficace ` +
    `en anglais, ex. « knee joint anatomy diagram », « heimlich maneuver illustration ») — ` +
    `jamais de photo de patient réel ni d'image potentiellement choquante.\n` +
    `- N'écris JAMAIS d'URL d'image toi-même et n'utilise pas la syntaxe markdown ![…](…) : ` +
    `le marqueur est résolu automatiquement par l'application.`
  );
}
