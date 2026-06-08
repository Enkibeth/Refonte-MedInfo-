import { describe, expect, it } from 'vitest';

import { sanitizeMedicalReport } from '@/ai/audio/sanitizeReport';

describe('sanitizeMedicalReport', () => {
  it('retire les emojis et pictogrammes décoratifs', () => {
    const out = sanitizeMedicalReport('## 📋 Compte rendu\n\n⚠️ Note : à vérifier.');
    expect(out).not.toMatch(/[📋⚠️]/u);
    expect(out).toContain('Compte rendu');
    expect(out).toContain('Note : à vérifier.');
  });

  it('normalise les titres # / ### en ##', () => {
    const out = sanitizeMedicalReport('# Titre\n### Sous-titre');
    expect(out).toContain('## Titre');
    expect(out).toContain('## Sous-titre');
    expect(out).not.toMatch(/^#\s/m);
    expect(out).not.toMatch(/^###\s/m);
  });

  it('retire les citations « > » et homogénéise les puces', () => {
    const out = sanitizeMedicalReport('> Note préliminaire\n• point A\n* point B');
    expect(out).not.toMatch(/^>/m);
    expect(out).toContain('Note préliminaire');
    expect(out).toContain('- point A');
    expect(out).toContain('- point B');
  });

  it('préserve les accents, le gras et les sections cliniques', () => {
    const out = sanitizeMedicalReport('## Motif\n\n**Antécédents** : céphalées fébriles aiguës.');
    expect(out).toContain('## Motif');
    expect(out).toContain('**Antécédents**');
    expect(out).toContain('céphalées fébriles aiguës');
  });

  it('réduit les lignes vides multiples', () => {
    const out = sanitizeMedicalReport('A\n\n\n\nB');
    expect(out).toBe('A\n\nB');
  });
});
