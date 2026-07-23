import { describe, it, expect } from 'vitest';

import { GRAIN_TILE, grainDataUri } from '@/ui/grain';

describe('grainDataUri — grain filmique (Grainient)', () => {
  it('produit un data-URI SVG utilisable en background-image', () => {
    const uri = grainDataUri();
    expect(uri.startsWith('data:image/svg+xml,')).toBe(true);
    // Aucun caractère non échappé qui casserait un url("…") en CSS.
    expect(uri).not.toContain('<');
    expect(uri).not.toContain('>');
    expect(uri).not.toContain('#');
    expect(uri).not.toContain(' ');
  });

  it('encode bien le bruit fractal désaturé (recette du grainy gradient)', () => {
    const uri = grainDataUri();
    // Les noms de balises/attributs restent littéraux après encodeURIComponent.
    expect(uri).toContain('feTurbulence');
    expect(uri).toContain('fractalNoise');
    expect(uri).toContain('feColorMatrix');
    // La tuile déclarée se retrouve dans les dimensions du SVG.
    expect(uri).toContain(String(GRAIN_TILE));
  });

  it('expose une taille de tuile positive', () => {
    expect(GRAIN_TILE).toBeGreaterThan(0);
  });
});
