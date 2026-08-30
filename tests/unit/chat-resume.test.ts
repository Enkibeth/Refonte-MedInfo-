import { describe, it, expect } from 'vitest';

import { RESUME_PREFIX_LEN, shouldReplaceWithArchived } from '@/chat/resume';

const LONG = 'Voici une réponse clinique complète et détaillée sur le sujet demandé, avec ses sections.';

describe('shouldReplaceWithArchived — compléter une réponse coupée par la mise en veille', () => {
  it('remplace une réponse tronquée par la version archivée complète', () => {
    const tronquee = LONG.slice(0, 40);
    expect(shouldReplaceWithArchived(tronquee, LONG)).toBe(true);
  });

  it("remplace quand rien n'est affiché (flux coupé avant le premier mot)", () => {
    expect(shouldReplaceWithArchived('', LONG)).toBe(true);
    expect(shouldReplaceWithArchived(null, LONG)).toBe(true);
    expect(shouldReplaceWithArchived(undefined, LONG)).toBe(true);
  });

  it('ne touche à rien si le serveur n’a rien archivé', () => {
    expect(shouldReplaceWithArchived(LONG, '')).toBe(false);
    expect(shouldReplaceWithArchived(LONG, null)).toBe(false);
    expect(shouldReplaceWithArchived('', '')).toBe(false);
  });

  it('ne remplace pas une réponse déjà complète (archive identique ou plus courte)', () => {
    expect(shouldReplaceWithArchived(LONG, LONG)).toBe(false);
    expect(shouldReplaceWithArchived(LONG, LONG.slice(0, 30))).toBe(false);
  });

  it('ne remplace JAMAIS par une réponse différente, même plus longue', () => {
    // Cas réel à éviter : une régénération courte se ferait écraser par l'archive de la
    // réponse précédente si l'on ne comparait que les longueurs.
    const autre = `Tout autre sujet, sans rapport. ${LONG}`;
    expect(shouldReplaceWithArchived('Réponse fraîche et brève.', autre)).toBe(false);
  });

  it('tolère les différences d’espaces et de casse dans le préfixe', () => {
    const tronquee = LONG.slice(0, 50).toUpperCase().replace(/ /g, '   ');
    expect(shouldReplaceWithArchived(tronquee, LONG)).toBe(true);
  });

  it('compare sur un préfixe borné : une divergence tardive ne bloque pas la reprise', () => {
    const local = LONG.slice(0, RESUME_PREFIX_LEN + 10);
    expect(shouldReplaceWithArchived(local, LONG)).toBe(true);
  });

  it('un local plus court que le préfixe de comparaison reste géré', () => {
    expect(shouldReplaceWithArchived('Voici', LONG)).toBe(true);
    expect(shouldReplaceWithArchived('Autre', LONG)).toBe(false);
  });
});
