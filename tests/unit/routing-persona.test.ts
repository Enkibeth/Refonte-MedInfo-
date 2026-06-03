import { describe, expect, it } from 'vitest';

import {
  PERSONA_ROUTES,
  isPersonaEnabled,
  resolvePersonaRoute,
} from '@/ai/routing/persona';

/**
 * Routing par persona (ADR-0006) : public + student activés au MVP, professional REPORTÉ.
 * Le module pro doit rester routable dans le code mais jamais servi en surface UI.
 */
describe('routing par persona — MVP', () => {
  it('public et student sont activés au MVP', () => {
    expect(isPersonaEnabled('public')).toBe(true);
    expect(isPersonaEnabled('student')).toBe(true);
  });

  it('professional est routable mais désactivé au MVP (enabledInMvp=false)', () => {
    expect(PERSONA_ROUTES.professional).toBeDefined();
    expect(isPersonaEnabled('professional')).toBe(false);
  });

  it('resolvePersonaRoute(public|student) → autorisé vers (chat)', () => {
    expect(resolvePersonaRoute('public')).toEqual({ allowed: true, group: '(chat)' });
    expect(resolvePersonaRoute('student')).toEqual({ allowed: true, group: '(chat)' });
  });

  it('resolvePersonaRoute(professional) → refusé, reporté post-MVP (aucune surface pro)', () => {
    const res = resolvePersonaRoute('professional');
    expect(res.allowed).toBe(false);
    if (!res.allowed) {
      expect(res.reason).toBe('reported_post_mvp');
    }
  });
});
