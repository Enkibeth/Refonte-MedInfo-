/**
 * Cible de déploiement (Vercel ↔ Hostinger).
 *
 * Enjeu : l'identité de l'hébergeur affichée dans les mentions légales est une obligation
 * LCEN (art. 6-III). Une valeur mal normalisée afficherait le mauvais hébergeur, ou pire,
 * ferait retomber le site sur un hébergeur inventé. Le défaut doit rester `vercel` tant que
 * la variable n'est pas posée au build.
 */
import { describe, expect, it } from 'vitest';

import {
  getHostingProvider,
  isVercelAnalyticsEnabled,
  resolveDeployTarget,
} from '@/deploy/target';

describe('resolveDeployTarget', () => {
  it('retombe sur vercel par défaut (hébergement historique)', () => {
    expect(resolveDeployTarget(undefined)).toBe('vercel');
    expect(resolveDeployTarget('')).toBe('vercel');
    expect(resolveDeployTarget('  ')).toBe('vercel');
  });

  it('reconnaît hostinger et ses synonymes, insensible à la casse', () => {
    expect(resolveDeployTarget('hostinger')).toBe('hostinger');
    expect(resolveDeployTarget('Hostinger')).toBe('hostinger');
    expect(resolveDeployTarget(' NODE ')).toBe('hostinger');
    expect(resolveDeployTarget('self-hosted')).toBe('hostinger');
  });

  it("n'invente jamais d'hébergeur sur une valeur inconnue", () => {
    expect(resolveDeployTarget('netlify')).toBe('vercel');
    expect(resolveDeployTarget('ovh')).toBe('vercel');
  });
});

describe('isVercelAnalyticsEnabled', () => {
  it('ne monte les scripts Vercel que sur Vercel', () => {
    expect(isVercelAnalyticsEnabled(undefined)).toBe(true);
    expect(isVercelAnalyticsEnabled('vercel')).toBe(true);
    expect(isVercelAnalyticsEnabled('hostinger')).toBe(false);
  });
});

describe('getHostingProvider', () => {
  it('nomme Vercel par défaut', () => {
    const provider = getHostingProvider(undefined);
    expect(provider.name).toBe('Vercel Inc.');
    expect(provider.sentence).toContain('Vercel Inc.');
    expect(provider.processorLine).toContain('Vercel');
  });

  it('nomme Hostinger quand le site y est servi', () => {
    const provider = getHostingProvider('hostinger');
    expect(provider.name).toBe('Hostinger International Ltd.');
    expect(provider.address).toContain('Larnaca');
    expect(provider.sentence).toContain('Hostinger International Ltd.');
    expect(provider.processorLine).toContain('Hostinger');
  });

  it('laisse la région du serveur en champ à compléter plutôt que de la deviner', () => {
    expect(getHostingProvider('hostinger').sentence).toContain('[À COMPLÉTER');
    expect(getHostingProvider('vercel').sentence).not.toContain('[À COMPLÉTER');
  });
});
