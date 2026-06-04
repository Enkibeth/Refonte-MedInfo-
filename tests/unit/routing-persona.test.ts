import { describe, expect, it } from 'vitest';

import {
  PERSONA_ROUTES,
  isPersonaEnabled,
  resolvePersonaRoute,
} from '@/ai/routing/persona';

/**
 * Routing par persona (ADR-0006 amendé par ADR-0011) : public + student + professional
 * actifs. Le pro reste soumis à la safe-box ; ses features cliniques restent gelées (ADR-0006).
 */
describe('routing par persona', () => {
  it('les trois personas sont activées', () => {
    expect(isPersonaEnabled('public')).toBe(true);
    expect(isPersonaEnabled('student')).toBe(true);
    expect(isPersonaEnabled('professional')).toBe(true);
  });

  it('professional est défini et routable', () => {
    expect(PERSONA_ROUTES.professional).toBeDefined();
  });

  it('resolvePersonaRoute(public|student|professional) → autorisé vers (chat)', () => {
    expect(resolvePersonaRoute('public')).toEqual({ allowed: true, group: '(chat)' });
    expect(resolvePersonaRoute('student')).toEqual({ allowed: true, group: '(chat)' });
    expect(resolvePersonaRoute('professional')).toEqual({ allowed: true, group: '(chat)' });
  });
});
