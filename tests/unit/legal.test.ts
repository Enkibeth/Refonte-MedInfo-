import { describe, expect, it } from 'vitest';

import { CANONICAL_REFUSAL, INTENDED_PURPOSE } from '@/compliance/disclosures';
import {
  cgu,
  confidentialite,
  legalDocuments,
  legalLinks,
  mentionsLegales,
} from '@/compliance/legal';

function fullText(doc: { intro: string; sections: { heading: string; body: string[] }[] }): string {
  return [doc.intro, ...doc.sections.flatMap((s) => [s.heading, ...s.body])].join('\n');
}

describe('documents légaux — structure', () => {
  it('expose 3 documents avec slug unique et au moins une section chacun', () => {
    const docs = Object.values(legalDocuments);
    expect(docs).toHaveLength(3);
    const slugs = docs.map((d) => d.slug);
    expect(new Set(slugs).size).toBe(3);
    for (const doc of docs) {
      expect(doc.title.length).toBeGreaterThan(0);
      expect(doc.sections.length).toBeGreaterThan(0);
      expect(doc.sections.every((s) => s.body.length > 0)).toBe(true);
    }
  });

  it('legalLinks couvre tous les documents', () => {
    expect(legalLinks.map((l) => l.slug).sort()).toEqual(
      Object.values(legalDocuments)
        .map((d) => d.slug)
        .sort(),
    );
  });
});

describe('mentions légales — LCEN', () => {
  it("nomme éditeur, hébergeur et nature non-MDSW du service", () => {
    const text = fullText(mentionsLegales);
    expect(text).toMatch(/éditeur|édité par/i);
    expect(text).toMatch(/Vercel|Supabase/);
    expect(text).toContain(INTENDED_PURPOSE);
  });
});

describe('politique de confidentialité — RGPD', () => {
  const text = fullText(confidentialite);

  it('énumère les droits RGPD et la voie de réclamation CNIL', () => {
    expect(text).toMatch(/accès/);
    expect(text).toMatch(/rectification/);
    expect(text).toMatch(/effacement/);
    expect(text).toMatch(/portabilité/);
    expect(text).toMatch(/CNIL/);
  });

  it('cite les sous-traitants (art. 28) dont Stripe et les fournisseurs IA', () => {
    expect(text).toMatch(/Stripe/);
    expect(text).toMatch(/Anthropic|OpenAI/);
    expect(text).toMatch(/art\.?\s*28|sous-traitant/i);
  });

  it('mentionne la disclosure AI Act (art. 50) et le principe zéro donnée de santé', () => {
    expect(text).toMatch(/intelligence artificielle/i);
    expect(text).toMatch(/article\s*50|AI Act/i);
    expect(text).toMatch(/donnée de santé/i);
  });
});

describe('CGU/CGV', () => {
  const text = fullText(cgu);

  it('porte l’avertissement médical canonique et les numéros d’urgence', () => {
    expect(text).toContain(CANONICAL_REFUSAL);
    expect(text).toMatch(/\b15\b/);
    expect(text).toMatch(/112/);
    expect(text).toMatch(/3114/);
  });

  it('couvre abonnement Stripe, rétractation et droit applicable français', () => {
    expect(text).toMatch(/Stripe/);
    expect(text).toMatch(/rétractation/i);
    expect(text).toMatch(/droit français/i);
  });
});
