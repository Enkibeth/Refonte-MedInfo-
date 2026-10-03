import { describe, expect, it } from 'vitest';

import { PAGE_SEO, canonicalUrl } from '@/seo/meta';
import { buildLlmsTxt } from '@/seo/llms';

describe('/llms.txt', () => {
  const text = buildLlmsTxt();

  it('suit la convention llmstxt.org : titre, résumé en citation, sections de liens', () => {
    const lines = text.split('\n');
    expect(lines[0]).toBe('# MedInfo AI');
    expect(lines[2]).toMatch(/^> .+/);
    expect(text).toMatch(/^## Pages principales$/m);
  });

  it('rappelle les limites d’usage du service (information générale, urgences)', () => {
    expect(text).toContain('jamais un diagnostic ni un avis médical individuel');
    expect(text).toContain('15 (SAMU) ou le 112');
  });

  it('liste chaque page indexable avec son URL canonique et la description SEO du site', () => {
    for (const page of Object.values(PAGE_SEO)) {
      expect(text).toContain(`[${page.title}](${canonicalUrl(page.path)}): ${page.description}`);
    }
  });
});
