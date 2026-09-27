import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
vi.mock('react-native', () => ({ Platform: { OS: 'web', select: (values: { web?: unknown; default?: unknown }) => values.web ?? values.default } }));
import { standaloneTokenCss } from '@/ui/standaloneTheme';

describe('contrat des pages autonomes', () => {
  it('garde leur feuille de variables strictement alignée sur les tokens', () => {
    expect(readFileSync('public/medinfo-tokens.css', 'utf8')).toBe(standaloneTokenCss());
    for (const page of ['article', 'cv-builder', 'presentation', 'partiel']) {
      const html = readFileSync(`public/${page}.html`, 'utf8');
      expect(html).toContain('href="/medinfo-tokens.css"');
      expect(html).toContain('href="/medinfo-ui.css"');
      expect(html).not.toMatch(/maximum-scale=1|user-scalable=no/);
    }
  });
});
