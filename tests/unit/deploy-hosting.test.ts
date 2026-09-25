/**
 * Hébergeur affiché par l'application (`src/deploy/hosting.ts`).
 *
 * Enjeu : l'identité de l'hébergeur dans les mentions légales est une obligation LCEN
 * (art. 6-III) et la liste des sous-traitants une obligation RGPD (art. 28). Ces chaînes
 * sont donc verrouillées par test — et la région, qu'on ne peut pas deviner, doit rester un
 * champ à compléter plutôt qu'une affirmation inventée.
 */
import { describe, expect, it } from 'vitest';

import { DEPLOY_TARGET, getHostingProvider } from '@/deploy/hosting';
import { mentionsLegales, confidentialite } from '@/compliance/legal';

describe('getHostingProvider', () => {
  it('nomme Hostinger, l’hébergeur réel depuis la migration 2026-08', () => {
    const provider = getHostingProvider();
    expect(provider.name).toBe('Hostinger International Ltd.');
    expect(provider.address).toContain('Larnaca');
    expect(provider.sentence).toContain('Hostinger International Ltd.');
    expect(provider.processorLine).toContain('Hostinger');
  });

  it('laisse la région du serveur en champ à compléter plutôt que de la deviner', () => {
    expect(getHostingProvider().sentence).toContain('[À COMPLÉTER');
  });

  it('expose la cible de déploiement unique', () => {
    expect(DEPLOY_TARGET).toBe('hostinger');
  });
});

describe('documents légaux', () => {
  it('ne mentionne plus Vercel nulle part', () => {
    const texts = [...mentionsLegales.sections, ...confidentialite.sections]
      .flatMap((section) => section.body)
      .join('\n');
    expect(texts).not.toMatch(/vercel/i);
  });

  it("nomme Hostinger comme hébergeur ET comme sous-traitant", () => {
    const hosting = mentionsLegales.sections.find((s) => s.heading === 'Hébergement');
    expect(hosting?.body.join(' ')).toContain('Hostinger');

    const processors = confidentialite.sections.find(
      (s) => s.heading === 'Sous-traitants et destinataires',
    );
    expect(processors?.body.join(' ')).toContain('Hostinger');
  });
});
