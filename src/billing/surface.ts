/**
 * Surface de facturation (06_BILLING §3 — web-first, ZÉRO IAP, ADR-0012).
 *
 * Règle Apple 3.1.3(b) Multiplatform : l'app iOS/Android ne mentionne JAMAIS de prix ni de
 * bouton d'achat ; elle sert de client à un compte déjà souscrit sur le web. Tout achat se
 * fait sur le site web. Garde-fou testé (tests/unit/billing-surface.test.ts).
 */
export function shouldShowWebBilling(platformOS: string): boolean {
  return platformOS === 'web';
}
