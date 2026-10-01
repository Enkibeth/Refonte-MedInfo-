import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
vi.mock('react-native', () => ({ Platform: { OS: 'web', select: (values: { web?: unknown; default?: unknown }) => values.web ?? values.default } }));
import { standaloneTokenCss } from '@/ui/standaloneTheme';
import { tokens } from '@/ui/tokens';

function luminance(hex: string): number {
  const rgb = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

function contrast(foreground: string, background: string): number {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

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

describe('palette éditoriale vivante', () => {
  it('distingue les fonds de page des surfaces de lecture', () => {
    expect(tokens.colors.background).not.toBe(tokens.colors.surface);
    expect(tokens.colors.surface).toBe('#FFFFFF');
    expect(new Set(Object.values(tokens.colors.personas).map(color => color.soft)).size).toBe(3);
  });

  it('conserve au moins 4,5:1 pour les textes sur chaque nouvelle surface', () => {
    const surfaces = [tokens.colors.background, tokens.colors.surfaceAlt, tokens.colors.editorial.hero,
      tokens.colors.editorial.photoMount, tokens.colors.editorial.warmMount,
      ...Object.values(tokens.colors.personas).map(color => color.soft)];
    for (const surface of surfaces) {
      expect(contrast(tokens.colors.text, surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokens.colors.textMuted, surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokens.colors.accent, surface)).toBeGreaterThanOrEqual(4.5);
    }
    for (const color of Object.values(tokens.colors.personas)) {
      expect(contrast(color.accent, color.soft)).toBeGreaterThanOrEqual(4.5);
    }
    for (const tint of Object.values(tokens.colors.tints)) {
      expect(contrast(tint.fg, tint.bg)).toBeGreaterThanOrEqual(4.5);
    }
    for (const foreground of [tokens.colors.editorial.onInk, tokens.colors.editorial.onInkMuted, tokens.colors.editorial.highlight]) {
      expect(contrast(foreground, tokens.colors.editorial.ink)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
