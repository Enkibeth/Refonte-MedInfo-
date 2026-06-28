/**
 * Contexte serveur du générateur de présentations (mode IA).
 *
 * Module PUR et testable : il construit la section dynamique à AJOUTER au prompt
 * système (`presentation_generate`, source de vérité côté serveur — promptStore).
 * Le client n'envoie JAMAIS de prompt système : il transmet seulement son intention
 * (options) et l'état courant du deck. Le serveur garde la maîtrise du prompt.
 *
 * Aucune donnée de santé personnelle ici : un deck est un support de présentation
 * (information médicale générale, jamais un dossier patient).
 */

export interface PresentationOptions {
  /** Thème graphique demandé (v1/v2/v3). */
  theme: string;
  /** Densité de texte souhaitée. */
  density: 'bullets' | 'prose' | 'mixed';
  /** Public visé (texte libre court). */
  audience: string;
  /** Nombre de slides cible (cover + references incluses), ou null = au choix du modèle. */
  slideCount: number | null;
  /** Type de présentation (texte libre court : cas clinique, journal club…). */
  presentationType: string;
}

const DENSITY_RULES: Record<PresentationOptions['density'], string> = {
  bullets:
    "Privilégie des PUCES denses (3 à 6 par slide, type 'bullets'/'twoColumn'/'steps'). Phrases courtes.",
  prose: "Privilégie le TEXTE RÉDIGÉ (type 'prose'), paragraphes fluides, peu de puces.",
  mixed: 'Mélange puces et texte rédigé selon ce qui sert le mieux chaque idée.',
};

/** Taille maximale du deck sérialisé injecté dans le prompt (garde-fou payload). */
export const MAX_DECK_JSON_CHARS = 60_000;

function clampString(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max).trim() : '';
}

/** Normalise les options venues du client (jamais une autorisation, juste une intention). */
export function coercePresentationOptions(raw: unknown): PresentationOptions {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  const theme = ['v1', 'v2', 'v3'].includes(o.theme as string) ? (o.theme as string) : 'v2';
  const density = ['bullets', 'prose', 'mixed'].includes(o.density as string)
    ? (o.density as PresentationOptions['density'])
    : 'bullets';

  let slideCount: number | null = null;
  const n = Number(o.slideCount);
  if (Number.isFinite(n) && n >= 3 && n <= 40) slideCount = Math.round(n);

  return {
    theme,
    density,
    audience: clampString(o.audience, 160),
    slideCount,
    presentationType: clampString(o.presentationType, 160),
  };
}

/**
 * Construit la section de contexte à concaténer au template `presentation_generate`.
 * Le `deck` (état courant, potentiellement édité à la main) est sérialisé et borné.
 */
export function buildPresentationContextSection(
  options: PresentationOptions,
  deck: unknown,
): string {
  const lines: string[] = ['', '# CONTEXTE DE CETTE PRÉSENTATION'];
  lines.push(`- Thème graphique demandé : ${options.theme}.`);
  lines.push(`- Densité souhaitée : ${options.density}. ${DENSITY_RULES[options.density]}`);
  if (options.slideCount) {
    lines.push(
      `- Nombre de slides cible : environ ${options.slideCount} (cover et references incluses). Adapte au temps de parole (~1 slide/min en staff dense, 1 slide/1,5–2 min en pédagogique).`,
    );
  } else {
    lines.push('- Nombre de slides : choisis-le selon le sujet et signale ton choix.');
  }
  if (options.audience) lines.push(`- Audience : ${options.audience}.`);
  if (options.presentationType) lines.push(`- Type : ${options.presentationType}.`);

  if (deck && typeof deck === 'object') {
    let serialized = '';
    try {
      serialized = JSON.stringify(deck);
    } catch {
      serialized = '';
    }
    if (serialized && serialized.length <= MAX_DECK_JSON_CHARS) {
      lines.push('');
      lines.push(
        '# ÉTAT ACTUEL DU DECK (peut avoir été édité manuellement par l\'utilisateur — pars de cet état)',
      );
      lines.push('```json');
      lines.push(serialized);
      lines.push('```');
    }
  }

  return lines.join('\n');
}
