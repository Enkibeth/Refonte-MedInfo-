import { describe, it, expect } from 'vitest';

import {
  RESPONSE_MODES,
  buildResponseModeSection,
  coerceResponseMode,
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
