import { describe, it, expect } from 'vitest';

import {
  buildCitationsFooter,
  citationsFromSources,
  citationPagesLabel,
  splitAnalysisResult,
  visibleAnalysisText,
  CITATIONS_MARKER,
} from '@/document/citations';

const pdfSource = (citedText: string, startPage?: number, endPage?: number) => ({
  type: 'source',
  sourceType: 'document',
  id: 'x',
  providerMetadata: {
    anthropic: { citedText, startPageNumber: startPage, endPageNumber: endPage },
  },
});

describe('citationsFromSources', () => {
  it('extrait les passages des sources document (pages PDF comprises)', () => {
    const citations = citationsFromSources([
      pdfSource('Hémoglobine 9,2 g/dL', 2, 2),
      { type: 'source', sourceType: 'url', url: 'https://x.fr' },
      pdfSource('Créatinine 180 µmol/L', 3),
    ]);
    expect(citations).toEqual([
      { text: 'Hémoglobine 9,2 g/dL', startPage: 2, endPage: 2 },
      { text: 'Créatinine 180 µmol/L', startPage: 3, endPage: undefined },
    ]);
  });

  it('déduplique, normalise les espaces et neutralise le marqueur de fin', () => {
    const citations = citationsFromSources([
      pdfSource('  Un   passage\n multiligne  '),
      pdfSource('un passage multiligne'),
      pdfSource('avant --> après'),
    ]);
    expect(citations).toHaveLength(2);
    expect(citations[0].text).toBe('Un passage multiligne');
    expect(citations[1].text).toBe('avant → après');
  });

  it('ignore les entrées vides ou malformées', () => {
    expect(citationsFromSources([{}, null, pdfSource('')])).toEqual([]);
  });
});

describe('buildCitationsFooter + splitAnalysisResult (aller-retour)', () => {
  it('sérialise puis re-parse fidèlement', () => {
    const footer = buildCitationsFooter([pdfSource('NT-proBNP 2 400 ng/L', 1, 2)]);
    const raw = `## Résumé\n\nTexte de l'analyse.${footer}`;
    const { text, citations } = splitAnalysisResult(raw);
    expect(text).toBe("## Résumé\n\nTexte de l'analyse.");
    expect(citations).toEqual([{ text: 'NT-proBNP 2 400 ng/L', startPage: 1, endPage: 2 }]);
  });

  it('pied vide quand aucune citation ; parse tolérant sans pied ou pied corrompu', () => {
    expect(buildCitationsFooter([])).toBe('');
    expect(splitAnalysisResult('Texte simple')).toEqual({ text: 'Texte simple', citations: [] });
    const broken = `Texte${CITATIONS_MARKER}{pas du json`;
    expect(splitAnalysisResult(broken).citations).toEqual([]);
  });
});

describe('visibleAnalysisText — affichage progressif', () => {
  it('masque le pied complet et le marqueur partiel en fin de flux', () => {
    const footer = buildCitationsFooter([pdfSource('x')]);
    expect(visibleAnalysisText(`Analyse.${footer}`)).toBe('Analyse.');
    expect(visibleAnalysisText('Analyse.\n\n<!--CITA')).toBe('Analyse.');
    expect(visibleAnalysisText('Analyse en cours')).toBe('Analyse en cours');
  });
});

describe('citationPagesLabel', () => {
  it('rend « p. n » ou « p. a–b », null sans page', () => {
    expect(citationPagesLabel({ text: 'x', startPage: 3, endPage: 3 })).toBe('p. 3');
    expect(citationPagesLabel({ text: 'x', startPage: 3, endPage: 5 })).toBe('p. 3–5');
    expect(citationPagesLabel({ text: 'x' })).toBeNull();
  });
});
