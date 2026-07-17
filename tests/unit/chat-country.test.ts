import { describe, it, expect } from 'vitest';

import {
  COUNTRIES,
  buildCountryContextSection,
  coerceCountry,
  getCountry,
} from '@/ai/chat/country';

describe('country — coercion', () => {
  it('accepte un code connu, insensible à la casse et aux espaces', () => {
    expect(coerceCountry('FR')).toBe('FR');
    expect(coerceCountry('fr')).toBe('FR');
    expect(coerceCountry('  be  ')).toBe('BE');
    expect(coerceCountry('OTHER')).toBe('OTHER');
  });

  it('rejette une valeur inconnue ou non-string', () => {
    expect(coerceCountry('XX')).toBeNull();
    expect(coerceCountry('')).toBeNull();
    expect(coerceCountry(123)).toBeNull();
    expect(coerceCountry(null)).toBeNull();
    expect(coerceCountry(undefined)).toBeNull();
  });

  it('tous les codes du catalogue sont uniques et coercibles', () => {
    const codes = COUNTRIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of COUNTRIES) {
      expect(coerceCountry(c.code)).toBe(c.code);
      expect(getCountry(c.code)?.name.length).toBeGreaterThan(1);
      expect(c.sources.length).toBeGreaterThan(0);
    }
  });
});

describe('country — section de contexte', () => {
  it('vide si aucun pays', () => {
    expect(buildCountryContextSection(null)).toBe('');
  });

  it('France : nomme le pays et ses sources officielles', () => {
    const s = buildCountryContextSection('FR');
    expect(s).toContain('CONTEXTE PAYS');
    expect(s).toContain('France');
    expect(s).toContain('ANSM');
    expect(s).toContain('RCP');
  });

  it('International : oriente vers EMA / OMS', () => {
    const s = buildCountryContextSection('OTHER');
    expect(s).toContain('International');
    expect(s.toLowerCase()).toContain('ema');
  });

  it('signale que l’information peut différer d’un pays à l’autre', () => {
    expect(buildCountryContextSection('BE')).toContain('différer');
  });
});
