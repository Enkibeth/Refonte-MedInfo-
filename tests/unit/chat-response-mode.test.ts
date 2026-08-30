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
  it('rapide : effort minimal, budget réduit, AUCUNE recherche — quel que soit le chatbot', () => {
    for (const bot of ['public', 'student', 'professional'] as const) {
      const r = responseModeRuntime('fast', bot);
      expect(r.reasoningEffort).toBe('minimal');
      expect(r.verbosity).toBe('low');
      expect(r.webSearch).toBe(false);
    }
  });

  it('standard public : conserve le plafond minimal (cloisonnement coût historique)', () => {
    const r = responseModeRuntime('standard', 'public');
    expect(r.capReasoningEffort).toBe('minimal');
    expect(r.reasoningEffort).toBeUndefined();
  });

  it('standard étudiant/pro : aucune surcharge (config admin telle quelle)', () => {
    const r = responseModeRuntime('standard', 'student');
    expect(r.capReasoningEffort).toBeUndefined();
    expect(r.reasoningEffort).toBeUndefined();
  });

  it('approfondi public : plafonné à medium, jamais high (cloisonnement coût)', () => {
    const r = responseModeRuntime('deep', 'public');
    expect(r.capReasoningEffort).toBe('medium');
    expect(r.reasoningEffort).toBeUndefined();
    expect(r.verbosity).toBe('high');
  });

  it('approfondi étudiant/pro : effort high explicite', () => {
    const r = responseModeRuntime('deep', 'professional');
    expect(r.reasoningEffort).toBe('high');
    expect(r.verbosity).toBe('high');
  });

  it('seul le mode rapide coupe la recherche web (ADR-0037 : un seul appel partout)', () => {
    for (const mode of RESPONSE_MODES) {
      const r = responseModeRuntime(mode, 'public');
      expect(r.webSearch).toBe(mode === 'fast' ? false : undefined);
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

describe('mode rapide — une réponse directe, sans recherche', () => {
  it('coupe la recherche web quel que soit le chatbot', () => {
    for (const bot of ['public', 'student', 'professional'] as const) {
      const r = responseModeRuntime('fast', bot);
      expect(r.webSearch).toBe(false);
      expect(r.reasoningEffort).toBe('minimal');
    }
  });

  it('laisse un budget de sortie viable : trop serré, la réponse revient vide', () => {
    // L'ancien plafond (1400 tokens, raisonnement compris) produisait « la réponse a
    // peut-être été interrompue ».
    expect(responseModeRuntime('fast', 'student').maxOutputTokens).toBeGreaterThanOrEqual(2048);
  });

  it('les autres modes gardent la recherche web (config admin de `chat`)', () => {
    expect(responseModeRuntime('standard', 'student').webSearch).toBeUndefined();
    expect(responseModeRuntime('deep', 'student').webSearch).toBeUndefined();
  });

  it('interdit explicitement de citer des sources qu’il ne peut pas vérifier', () => {
    const section = buildResponseModeSection('fast');
    expect(section).toMatch(/SANS recherche/i);
    expect(section).toMatch(/n.invente jamais d.url/i);
    expect(section).toMatch(/pas de section SOURCES/i);
    // Et il doit orienter vers un mode qui, lui, recherche.
    expect(section).toMatch(/Classique|Approfondi/);
  });

  it('conserve le cadrage de sécurité que le volet pharmacologie n’apporte plus ici', () => {
    const section = buildResponseModeSection('fast');
    expect(section).toMatch(/INDICATIVE/i);
    expect(section).toMatch(/n.invente jamais un chiffre/i);
    expect(section).toMatch(/sécurité/i);
  });
});
