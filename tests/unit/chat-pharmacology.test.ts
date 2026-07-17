import { describe, it, expect } from 'vitest';

import { buildPharmacologySection } from '@/ai/chat/pharmacology';

describe('pharmacology — section de renfort', () => {
  it('vide pour le grand public', () => {
    expect(buildPharmacologySection('public')).toBe('');
  });

  it('non vide pour étudiant et professionnel', () => {
    expect(buildPharmacologySection('student').length).toBeGreaterThan(200);
    expect(buildPharmacologySection('professional').length).toBeGreaterThan(200);
  });

  it('impose la priorisation des sources officielles (ANSM/RCP, EMA)', () => {
    const s = buildPharmacologySection('professional');
    expect(s).toContain('VOLET PHARMACOLOGIE');
    expect(s).toContain('ANSM');
    expect(s).toContain('RCP');
    expect(s).toContain('EMA');
    expect(s).toContain('interactions');
  });

  it('exige une profondeur adaptée à la complexité', () => {
    const s = buildPharmacologySection('student');
    expect(s).toContain('PROFONDEUR');
  });

  it('cadre les équivalences de doses de façon sûre (validation prescripteur, pas d’invention)', () => {
    const s = buildPharmacologySection('professional');
    expect(s).toContain('ÉQUIVALENCES DE DOSES');
    expect(s.toLowerCase()).toContain('prescripteur');
    expect(s).toContain('jamais'); // n'invente jamais un chiffre / jamais de prescription ferme
  });
});
