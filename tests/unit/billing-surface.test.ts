import { describe, it, expect } from 'vitest';

import { shouldShowWebBilling } from '@/billing/surface';

/**
 * Garde-fou web-first / zéro IAP (06_BILLING §3, règle Apple 3.1.3(b)).
 * Aucun prix ni bouton d'achat sur natif.
 */
describe('shouldShowWebBilling', () => {
  it('affiche la facturation uniquement sur le web', () => {
    expect(shouldShowWebBilling('web')).toBe(true);
  });

  it('ne montre RIEN sur iOS / Android (pas de prix, pas de bouton d’achat)', () => {
    expect(shouldShowWebBilling('ios')).toBe(false);
    expect(shouldShowWebBilling('android')).toBe(false);
  });
});
