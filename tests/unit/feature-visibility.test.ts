import { describe, it, expect } from 'vitest';

import {
  APP_FEATURES,
  isFeatureVisible,
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

  it("l'étudiant voit Chat + ECOS + Partiel (pas Document ni Audio)", () => {
    expect(idsFor('student')).toEqual(['chat', 'ecos', 'partiel']);
  });

  it('le professionnel voit Chat + Audio (pas ECOS/Partiel/Document)', () => {
    expect(idsFor('professional')).toEqual(['chat', 'audio']);
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
  });

  it("l'étudiant ne voit PAS Document (grand public) ni Audio (pro)", () => {
    expect(isFeatureVisible('document', 'student')).toBe(false);
    expect(isFeatureVisible('audio', 'student')).toBe(false);
    expect(isFeatureVisible('partiel', 'student')).toBe(true);
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
