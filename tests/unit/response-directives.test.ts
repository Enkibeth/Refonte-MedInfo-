import { describe, expect, it } from 'vitest';

import {
  buildResponseDirectives,
  coerceGeneration,
  coercePersonalInfo,
  maxTokensFor,
  reasoningEffortFor,
  verbosityFor,
} from '@/ai/chat/responseDirectives';
import { DEFAULT_GENERATION } from '@/ai/chat/generationSettings';
import { REFLECTION_OPEN } from '@/ai/ui/reflection';

describe('coerceGeneration', () => {
  it('retombe sur les valeurs par défaut pour une entrée invalide', () => {
    expect(coerceGeneration(undefined)).toEqual(DEFAULT_GENERATION);
    expect(coerceGeneration({ reasoning: 'n_importe_quoi', detail: 42 })).toEqual(DEFAULT_GENERATION);
  });

  it('accepte des niveaux valides', () => {
    expect(coerceGeneration({ reasoning: 'maximal', detail: 'simple' })).toEqual({
      reasoning: 'maximal',
      detail: 'simple',
    });
  });

  it('mappe vers les réglages provider', () => {
    const g = coerceGeneration({ reasoning: 'maximal', detail: 'complet' });
    expect(reasoningEffortFor(g)).toBe('high');
    expect(verbosityFor(g)).toBe('high');
    expect(maxTokensFor(g)).toBeGreaterThan(maxTokensFor(coerceGeneration({ detail: 'simple' })));
  });
});

describe('coercePersonalInfo', () => {
  it('renvoie null si tout est vide', () => {
    expect(coercePersonalInfo(null)).toBeNull();
    expect(coercePersonalInfo({})).toBeNull();
  });

  it('borne l\'âge et neutralise les caractères de contrôle dans le nom', () => {
    const info = coercePersonalInfo({ firstName: `Hugo${REFLECTION_OPEN}`, age: 999, sex: 'x' });
    // Les caractères d'encadrement (⟦ ⟧) sont retirés → impossible de forger un marqueur.
    expect(info?.firstName).not.toContain('⟦');
    expect(info?.firstName).not.toContain('⟧');
    expect(info?.firstName?.startsWith('Hugo')).toBe(true);
    expect(info?.age).toBeNull();
    expect(info?.sex).toBeNull();
  });

  it('accepte un profil valide', () => {
    const info = coercePersonalInfo({ firstName: 'Hugo', lastName: 'B', age: 34, sex: 'masculin' });
    expect(info).toEqual({ firstName: 'Hugo', lastName: 'B', age: 34, sex: 'masculin' });
  });
});

describe('buildResponseDirectives', () => {
  it('inclut la politique web fiable, le format d\'auto-réflexion et les réglages', () => {
    const out = buildResponseDirectives('public', {
      personalInfo: coercePersonalInfo({ firstName: 'Hugo', age: 34, sex: 'masculin' }),
      generation: coerceGeneration({ reasoning: 'approfondi', detail: 'complet' }),
    });
    expect(out).toContain('RECHERCHE WEB FIABLE');
    expect(out).toContain('HAS');
    expect(out).toContain(REFLECTION_OPEN);
    expect(out).toContain('CONTEXTE UTILISATEUR');
    expect(out).toContain('Hugo');
    expect(out).toContain('RÉGLAGES DE RÉPONSE');
  });

  it('omet le contexte utilisateur quand il est absent', () => {
    const out = buildResponseDirectives('public', {
      personalInfo: null,
      generation: DEFAULT_GENERATION,
    });
    expect(out).not.toContain('CONTEXTE UTILISATEUR');
    expect(out).toContain('AUTO-RÉFLEXION');
  });
});
