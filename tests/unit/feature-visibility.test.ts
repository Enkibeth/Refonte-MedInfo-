import { describe, it, expect } from 'vitest';

import {
  APP_FEATURES,
  TAB_BAR_MAX,
  isFeatureVisible,
  tabBarFeatures,
  visibleFeatures,
  type AppFeatureId,
} from '@/ai/routing/featureVisibility';

function idsFor(persona: 'public' | 'student' | 'professional' | null, isAdmin = false): AppFeatureId[] {
  return visibleFeatures(persona, { isAdmin }).map((f) => f.id);
}

describe('featureVisibility — matrice stricte par rôle', () => {
  it('le grand public voit Chat + Document uniquement', () => {
    expect(idsFor('public')).toEqual(['chat', 'document']);
  });

  it("l'étudiant voit Chat + ECOS + Partiel + Révisions + Présentations + CV + Article (pas Document ni Audio)", () => {
    expect(idsFor('student')).toEqual(['chat', 'ecos', 'partiel', 'revision', 'presentation', 'cv-builder', 'article']);
  });

  it('le professionnel voit Chat + Audio + Présentations + CV + Article (pas ECOS/Partiel/Document)', () => {
    expect(idsFor('professional')).toEqual(['chat', 'audio', 'presentation', 'cv-builder', 'article']);
  });

  it("l'admin voit toutes les fonctionnalités", () => {
    expect(idsFor('public', true)).toEqual(APP_FEATURES.map((f) => f.id));
  });

  it('une persona absente est traitée comme grand public', () => {
    expect(idsFor(null)).toEqual(['chat', 'document']);
  });
});

describe('featureVisibility — cloisonnement inter-rôles', () => {
  it("le grand public ne voit PAS les outils étudiant/pro", () => {
    expect(isFeatureVisible('ecos', 'public')).toBe(false);
    expect(isFeatureVisible('partiel', 'public')).toBe(false);
    expect(isFeatureVisible('audio', 'public')).toBe(false);
    expect(isFeatureVisible('presentation', 'public')).toBe(false);
    expect(isFeatureVisible('cv-builder', 'public')).toBe(false);
    expect(isFeatureVisible('article', 'public')).toBe(false);
  });

  it("le module Rédaction d'article est visible étudiant + pro (pas grand public)", () => {
    expect(isFeatureVisible('article', 'student')).toBe(true);
    expect(isFeatureVisible('article', 'professional')).toBe(true);
    expect(isFeatureVisible('article', 'public')).toBe(false);
  });

  it('le module CV est visible étudiant + pro (pas grand public)', () => {
    expect(isFeatureVisible('cv-builder', 'student')).toBe(true);
    expect(isFeatureVisible('cv-builder', 'professional')).toBe(true);
    expect(isFeatureVisible('cv-builder', 'public')).toBe(false);
  });

  it("l'étudiant ne voit PAS Document (grand public) ni Audio (pro)", () => {
    expect(isFeatureVisible('document', 'student')).toBe(false);
    expect(isFeatureVisible('audio', 'student')).toBe(false);
    expect(isFeatureVisible('partiel', 'student')).toBe(true);
  });

  it('le générateur de présentations est visible étudiant + pro (pas grand public)', () => {
    expect(isFeatureVisible('presentation', 'student')).toBe(true);
    expect(isFeatureVisible('presentation', 'professional')).toBe(true);
    expect(isFeatureVisible('presentation', 'public')).toBe(false);
  });

  it('le chat est commun à tous les rôles', () => {
    expect(isFeatureVisible('chat', 'public')).toBe(true);
    expect(isFeatureVisible('chat', 'student')).toBe(true);
    expect(isFeatureVisible('chat', 'professional')).toBe(true);
  });

  it("l'admin court-circuite la matrice (voit même Audio en étant public)", () => {
    expect(isFeatureVisible('audio', 'public', { isAdmin: true })).toBe(true);
  });
});

describe('featureVisibility — visiteur non connecté (essai sans inscription)', () => {
  it('le visiteur ne voit QUE le chat, aucun autre outil', () => {
    expect(visibleFeatures(null, { isGuest: true }).map((f) => f.id)).toEqual(['chat']);
  });

  it('chaque outil hors chat est invisible pour le visiteur', () => {
    for (const feature of APP_FEATURES.filter((f) => f.id !== 'chat')) {
      expect(isFeatureVisible(feature.id, null, { isGuest: true })).toBe(false);
      expect(isFeatureVisible(feature.id, 'public', { isGuest: true })).toBe(false);
    }
  });

  it('le chat reste visible pour le visiteur', () => {
    expect(isFeatureVisible('chat', null, { isGuest: true })).toBe(true);
  });
});

describe('tabBarFeatures — répartition barre du bas / panneau Outils (lisibilité mobile)', () => {
  const split = (persona: 'public' | 'student' | 'professional' | null, isAdmin = false, isGuest = false) => {
    const { bar, overflow } = tabBarFeatures(persona, { isAdmin, isGuest });
    return { bar: bar.map((f) => f.id), overflow: overflow.map((f) => f.id) };
  };

  it('la barre ne dépasse jamais TAB_BAR_MAX entrées, quel que soit le rôle', () => {
    for (const persona of ['public', 'student', 'professional', null] as const) {
      expect(tabBarFeatures(persona).bar.length).toBeLessThanOrEqual(TAB_BAR_MAX);
    }
    expect(tabBarFeatures('public', { isAdmin: true }).bar.length).toBeLessThanOrEqual(TAB_BAR_MAX);
  });

  it('grand public : tout tient dans la barre, pas de panneau', () => {
    expect(split('public')).toEqual({ bar: ['chat', 'document'], overflow: [] });
  });

  it('professionnel : 3 outils prioritaires + le reste dans le panneau', () => {
    expect(split('professional')).toEqual({
      bar: ['chat', 'audio', 'presentation'],
      overflow: ['cv-builder', 'article'],
    });
  });

  it('étudiant : 3 outils prioritaires + le reste dans le panneau', () => {
    expect(split('student')).toEqual({
      bar: ['chat', 'ecos', 'revision'],
      overflow: ['partiel', 'presentation', 'cv-builder', 'article'],
    });
  });

  it('admin : 3 prioritaires + le reste dans le panneau (rien de perdu)', () => {
    const { bar, overflow } = split('public', true);
    expect(bar).toEqual(['chat', 'document', 'ecos']);
    expect([...bar, ...overflow].sort()).toEqual(APP_FEATURES.map((f) => f.id).sort());
  });

  it('barre + panneau = exactement les outils visibles du rôle (aucun doublon, aucun oubli)', () => {
    for (const persona of ['public', 'student', 'professional'] as const) {
      const { bar, overflow } = split(persona);
      const all = [...bar, ...overflow];
      expect(new Set(all).size).toBe(all.length);
      expect(all.sort()).toEqual(visibleFeatures(persona).map((f) => f.id).sort());
    }
  });

  it('visiteur non connecté : seul le chat, pas de panneau', () => {
    expect(split(null, false, true)).toEqual({ bar: ['chat'], overflow: [] });
  });

  it("slot réservé (onglet Accueil) : la capacité se réduit d'autant", () => {
    // Étudiant avec 1 slot réservé : 4 − 1 (Accueil) − 1 (Outils) = 2 outils en barre.
    const { bar, overflow } = tabBarFeatures('student', {}, { reservedSlots: 1 });
    expect(bar.map((f) => f.id)).toEqual(['chat', 'ecos']);
    expect(bar.length + 1 + 1).toBeLessThanOrEqual(TAB_BAR_MAX + 1); // Accueil + Outils inclus
    expect([...bar, ...overflow].map((f) => f.id).sort()).toEqual(
      visibleFeatures('student').map((f) => f.id).sort(),
    );
  });

  it('slot réservé mais tout tient : pas de panneau (public : Accueil + 2 outils)', () => {
    const { bar, overflow } = tabBarFeatures('public', {}, { reservedSlots: 1 });
    expect(bar.map((f) => f.id)).toEqual(['chat', 'document']);
    expect(overflow).toEqual([]);
  });

  it('slots réservés extrêmes : la barre garde au moins un outil', () => {
    const { bar } = tabBarFeatures('student', {}, { reservedSlots: 10 });
    expect(bar.length).toBeGreaterThanOrEqual(1);
  });
});
