/**
 * Sommaire cliquable d'un article de blog — module PUR (testé dans
 * tests/unit/blog-toc.test.ts).
 *
 * Découpe le markdown d'un article en sections sur les titres `## ` (h2) :
 * l'intro (avant le premier h2) + une section par h2. La page article rend
 * chaque section dans une View mesurée (onLayout) et le sommaire défile
 * vers la position correspondante.
 */

export interface ArticleSection {
  /** Titre h2 de la section (null pour l'introduction avant le premier h2). */
  heading: string | null;
  /** Markdown de la section, SANS la ligne de titre. */
  markdown: string;
}

export function splitArticleSections(contentMd: string): ArticleSection[] {
  const lines = contentMd.replace(/\r\n/g, '\n').split('\n');
  const sections: ArticleSection[] = [];
  let heading: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    const md = buffer.join('\n').trim();
    buffer = [];
    if (heading !== null || md) sections.push({ heading, markdown: md });
  };

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    // `###` reste dans le corps (sous-titre) — seul `##` structure le sommaire.
    if (h2 && !line.startsWith('###')) {
      flush();
      heading = h2[1].trim();
      continue;
    }
    buffer.push(line);
  }
  flush();
  return sections;
}

/** Titres du sommaire (sections h2 uniquement, dans l'ordre de l'article). */
export function tableOfContents(contentMd: string): string[] {
  return splitArticleSections(contentMd)
    .map((s) => s.heading)
    .filter((h): h is string => Boolean(h));
}
