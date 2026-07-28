import { describe, it, expect } from 'vitest';

import {
  RESPONSE_MODES,
  buildResponseModeSection,
  coerceResponseMode,
  forceFinalAnswerStep,
  responseModeRuntime,
} from '@/ai/chat/responseMode';

describe('responseMode — coercion', () => {
  it('accepte les trois modes connus', () => {
    expect(coerceResponseMode('fast')).toBe('fast');
    expect(coerceResponseMode('standard')).toBe('standard');
    expect(coerceResponseMode('deep')).toBe('deep');
  });

  it('repli sur standard pour toute valeur invalide', () => {
    expect(coerceResponseMode('turbo')).toBe('standard');
    expect(coerceResponseMode('')).toBe('standard');
    expect(coerceResponseMode(null)).toBe('standard');
    expect(coerceResponseMode(undefined)).toBe('standard');
    expect(coerceResponseMode(42)).toBe('standard');
  });
});

describe('responseModeRuntime — mapping vers les surcharges', () => {
  it('rapide : effort minimal, boucle courte, budget réduit — quel que soit le chatbot', () => {
    for (const bot of ['public', 'student', 'professional'] as const) {
      const r = responseModeRuntime('fast', bot);
      expect(r.reasoningEffort).toBe('minimal');
      expect(r.verbosity).toBe('low');
      expect(r.maxSteps).toBeLessThan(5);
    }
  });

  it('standard public : conserve le plafond minimal, boucle bornée à 5 étapes (audit latence)', () => {
    const r = responseModeRuntime('standard', 'public');
    expect(r.capReasoningEffort).toBe('minimal');
    expect(r.reasoningEffort).toBeUndefined();
    expect(r.maxSteps).toBe(5);
  });

  it('standard étudiant/pro : aucune surcharge d’effort (config admin telle quelle), 5 étapes', () => {
    const r = responseModeRuntime('standard', 'student');
    expect(r.capReasoningEffort).toBeUndefined();
    expect(r.reasoningEffort).toBeUndefined();
    expect(r.maxSteps).toBe(5);
  });

  it('approfondi public : plafonné à medium, jamais high (cloisonnement coût), plus d’étapes que standard', () => {
    const r = responseModeRuntime('deep', 'public');
    expect(r.capReasoningEffort).toBe('medium');
    expect(r.reasoningEffort).toBeUndefined();
    expect(r.maxSteps).toBe(8);
    expect(r.maxSteps).toBeGreaterThan(responseModeRuntime('standard', 'public').maxSteps);
  });

  it('approfondi étudiant/pro : effort high explicite, plus d’étapes que standard', () => {
    const r = responseModeRuntime('deep', 'professional');
    expect(r.reasoningEffort).toBe('high');
    expect(r.maxSteps).toBe(8);
    expect(r.maxSteps).toBeGreaterThan(responseModeRuntime('standard', 'professional').maxSteps);
  });

  it('chaque mode déclare un plafond d’étapes strictement positif', () => {
    for (const mode of RESPONSE_MODES) {
      expect(responseModeRuntime(mode, 'public').maxSteps).toBeGreaterThan(0);
    }
  });
});

describe('buildResponseModeSection — consigne système', () => {
  it('standard n’ajoute rien', () => {
    expect(buildResponseModeSection('standard')).toBe('');
  });

  it('rapide et approfondi ajoutent une consigne de densité', () => {
    expect(buildResponseModeSection('fast')).toContain('RAPIDE');
    expect(buildResponseModeSection('deep')).toContain('APPROFONDI');
  });
});

describe('mode rapide — une réponse DIRECTE (retour Hugo 2026-07)', () => {
  it('demande un appel unique, sans outil ni split', () => {
    for (const bot of ['public', 'student', 'professional'] as const) {
      const r = responseModeRuntime('fast', bot);
      expect(r.directAnswer).toBe(true);
      expect(r.maxSteps).toBe(1);
      expect(r.reasoningEffort).toBe('minimal');
    }
  });

  it('laisse un budget de sortie viable : trop serré, la réponse revient vide', () => {
    // L'ancien plafond (1400 tokens, raisonnement compris) produisait « la réponse a
    // peut-être été interrompue ».
    expect(responseModeRuntime('fast', 'student').maxOutputTokens).toBeGreaterThanOrEqual(2048);
  });

  it('les autres modes gardent la boucle d’outils', () => {
    expect(responseModeRuntime('standard', 'student').directAnswer).toBeUndefined();
    expect(responseModeRuntime('deep', 'student').directAnswer).toBeUndefined();
    expect(responseModeRuntime('standard', 'student').maxSteps).toBeGreaterThan(1);
  });

  it('interdit explicitement de citer des sources qu’il ne peut pas vérifier', () => {
    const section = buildResponseModeSection('fast');
    expect(section).toMatch(/SANS recherche/i);
    expect(section).toMatch(/n.invente jamais d.url/i);
    expect(section).toMatch(/pas de section SOURCES/i);
    // Et il doit orienter vers un mode qui, lui, vérifie.
    expect(section).toMatch(/Classique|Approfondi/);
  });

  it('conserve le cadrage de sécurité que le volet pharmacologie n’apporte plus ici', () => {
    const section = buildResponseModeSection('fast');
    expect(section).toMatch(/INDICATIVE/i);
    expect(section).toMatch(/n.invente jamais un chiffre/i);
    expect(section).toMatch(/sécurité/i);
  });
});

describe('forceFinalAnswerStep — garde anti-réponse-vide (incident prod 2026-07-28)', () => {
  it('laisse les outils libres avant la dernière étape, puis force la rédaction', () => {
    const prepare = forceFinalAnswerStep(5);
    expect(prepare({ stepNumber: 0 })).toEqual({});
    expect(prepare({ stepNumber: 3 })).toEqual({});
    // Dernière étape autorisée (stepCountIs(5) → étapes 0..4) : plus AUCUN appel d'outil
    // possible — le modèle doit écrire sa réponse avec ce qu'il a rassemblé.
    expect(prepare({ stepNumber: 4 })).toEqual({ toolChoice: 'none' });
    // Défensif : au-delà du plafond (ne devrait pas arriver), toujours forcé.
    expect(prepare({ stepNumber: 9 })).toEqual({ toolChoice: 'none' });
  });

  it('plafond d’une seule étape → réponse directe dès la première', () => {
    expect(forceFinalAnswerStep(1)({ stepNumber: 0 })).toEqual({ toolChoice: 'none' });
    // Valeur dégénérée : jamais d'indice négatif.
    expect(forceFinalAnswerStep(0)({ stepNumber: 0 })).toEqual({ toolChoice: 'none' });
  });
});
