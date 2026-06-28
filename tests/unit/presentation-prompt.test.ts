import { describe, it, expect } from 'vitest';

import {
  buildPresentationContextSection,
  coercePresentationOptions,
  MAX_DECK_JSON_CHARS,
} from '@/presentation/presentationPrompt';

describe('coercePresentationOptions', () => {
  it('applique des valeurs par défaut sûres pour une entrée vide', () => {
    expect(coercePresentationOptions(undefined)).toEqual({
      theme: 'v2',
      density: 'bullets',
      audience: '',
      slideCount: null,
      presentationType: '',
    });
  });

  it('rejette les valeurs hors domaine (thème/densité inconnus, slideCount hors bornes)', () => {
    const o = coercePresentationOptions({ theme: 'v9', density: 'wild', slideCount: 999 });
    expect(o.theme).toBe('v2');
    expect(o.density).toBe('bullets');
    expect(o.slideCount).toBeNull();
  });

  it('conserve des valeurs valides et borne les chaînes', () => {
    const o = coercePresentationOptions({
      theme: 'v3',
      density: 'mixed',
      slideCount: 12,
      audience: 'Co-internes',
      presentationType: 'Journal club',
    });
    expect(o).toEqual({
      theme: 'v3',
      density: 'mixed',
      audience: 'Co-internes',
      slideCount: 12,
      presentationType: 'Journal club',
    });
    expect(coercePresentationOptions({ audience: 'a'.repeat(500) }).audience.length).toBe(160);
  });
});

describe('buildPresentationContextSection', () => {
  it('inclut le contexte (thème, densité, slideCount) et l\'état du deck', () => {
    const section = buildPresentationContextSection(
      coercePresentationOptions({ theme: 'v1', density: 'prose', slideCount: 8, audience: 'Staff' }),
      { meta: { title: 'DAPA-HF' }, slides: [] },
    );
    expect(section).toContain('# CONTEXTE DE CETTE PRÉSENTATION');
    expect(section).toContain('Thème graphique demandé : v1');
    expect(section).toContain('Nombre de slides cible : environ 8');
    expect(section).toContain('Audience : Staff');
    expect(section).toContain('# ÉTAT ACTUEL DU DECK');
    expect(section).toContain('DAPA-HF');
  });

  it('omet le deck quand il est absent', () => {
    const section = buildPresentationContextSection(coercePresentationOptions({}), null);
    expect(section).not.toContain('# ÉTAT ACTUEL DU DECK');
  });

  it('n\'injecte pas un deck trop volumineux (garde-fou payload)', () => {
    const huge = { blob: 'x'.repeat(MAX_DECK_JSON_CHARS + 100) };
    const section = buildPresentationContextSection(coercePresentationOptions({}), huge);
    expect(section).not.toContain('# ÉTAT ACTUEL DU DECK');
  });
});
