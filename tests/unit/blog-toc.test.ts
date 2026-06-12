/**
 * Tests du sommaire d'article de blog (src/blog/toc.ts).
 */
import { describe, expect, it } from 'vitest';
import { splitArticleSections, tableOfContents } from '@/blog/toc';

const ARTICLE = `Introduction de l'article, avant le premier titre.

## Première section

Contenu de la première section.

### Sous-titre

Détail sous le sous-titre.

## Deuxième section

Contenu deux.

## Ce qu'il faut retenir

- Point un
- Point deux`;

describe('splitArticleSections', () => {
  it("découpe l'article sur les titres ## en gardant l'intro", () => {
    const sections = splitArticleSections(ARTICLE);
    expect(sections.map((s) => s.heading)).toEqual([
      null,
      'Première section',
      'Deuxième section',
      "Ce qu'il faut retenir",
    ]);
    expect(sections[0].markdown).toContain('Introduction');
  });

  it('laisse les sous-titres ### dans le corps de leur section', () => {
    const sections = splitArticleSections(ARTICLE);
    expect(sections[1].markdown).toContain('### Sous-titre');
  });

  it('gère un article sans titres (une seule section intro)', () => {
    const sections = splitArticleSections('Juste un paragraphe.');
    expect(sections).toHaveLength(1);
    expect(sections[0].heading).toBeNull();
  });
});

describe('tableOfContents', () => {
  it('liste les titres ## dans l’ordre', () => {
    expect(tableOfContents(ARTICLE)).toEqual([
      'Première section',
      'Deuxième section',
      "Ce qu'il faut retenir",
    ]);
  });
});
