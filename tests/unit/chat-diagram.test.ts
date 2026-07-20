import { describe, it, expect } from 'vitest';

import {
  coerceDiagramSpec,
  diagramPlaceholder,
  diagramToText,
  extractDiagrams,
  parseDiagramSpec,
  replaceDiagramsWithText,
} from '@/ai/chat/diagram';

const VALID = {
  title: 'Prise en charge',
  nodes: [
    { kind: 'start', text: 'Symptôme X' },
    {
      kind: 'decision',
      text: 'Critère présent ?',
      branches: [
        { label: 'Oui', text: 'Voie A' },
        { label: 'Non', text: 'Voie B' },
      ],
    },
    { kind: 'end', text: 'Orientation' },
  ],
};

describe('diagram — coercion/validation', () => {
  it('valide et normalise une structure correcte', () => {
    const spec = coerceDiagramSpec(VALID);
    expect(spec).not.toBeNull();
    expect(spec!.title).toBe('Prise en charge');
    expect(spec!.nodes).toHaveLength(3);
    expect(spec!.nodes[1].branches).toHaveLength(2);
  });

  it('rejette une structure sans nœuds exploitables', () => {
    expect(coerceDiagramSpec({ nodes: [] })).toBeNull();
    expect(coerceDiagramSpec({ nodes: [{ kind: 'step' }] })).toBeNull(); // texte manquant
    expect(coerceDiagramSpec(null)).toBeNull();
    expect(coerceDiagramSpec('x')).toBeNull();
  });

  it('remplace un kind inconnu par "step" et borne les branches aux décisions', () => {
    const spec = coerceDiagramSpec({
      nodes: [
        { kind: 'weird', text: 'A', branches: [{ label: 'x', text: 'y' }] },
      ],
    });
    expect(spec!.nodes[0].kind).toBe('step');
    // branches ignorées hors decision
    expect(spec!.nodes[0].branches).toBeUndefined();
  });

  it('parseDiagramSpec tolère un JSON invalide', () => {
    expect(parseDiagramSpec('{pas du json')).toBeNull();
    expect(parseDiagramSpec('')).toBeNull();
    expect(parseDiagramSpec(JSON.stringify(VALID))).not.toBeNull();
  });
});

describe('diagram — extraction depuis le texte assistant', () => {
  it('remplace les blocs valides par un marqueur et collecte les diagrammes', () => {
    const text = `Intro.\n\n\`\`\`medinfo-diagram\n${JSON.stringify(VALID)}\n\`\`\`\n\nSuite.`;
    const { text: out, diagrams } = extractDiagrams(text);
    expect(diagrams).toHaveLength(1);
    expect(out).toContain(diagramPlaceholder(0));
    expect(out).not.toContain('medinfo-diagram');
  });

  it('efface un bloc invalide sans laisser de JSON brut', () => {
    const text = 'Avant\n```medinfo-diagram\n{cassé\n```\nAprès';
    const { text: out, diagrams } = extractDiagrams(text);
    expect(diagrams).toHaveLength(0);
    expect(out).not.toContain('medinfo-diagram');
    expect(out).not.toContain('cassé');
  });

  it('replaceDiagramsWithText produit un plan texte lisible', () => {
    const text = `Voici :\n\`\`\`medinfo-diagram\n${JSON.stringify(VALID)}\n\`\`\``;
    const out = replaceDiagramsWithText(text);
    expect(out).toContain('Prise en charge');
    expect(out).toContain('1. Symptôme X');
    expect(out).toContain('Oui : Voie A');
    expect(out).not.toContain('medinfo-diagram');
  });
});

describe('diagram — rendu texte', () => {
  it('numérote les nœuds et indente les branches', () => {
    const spec = coerceDiagramSpec(VALID)!;
    const txt = diagramToText(spec);
    expect(txt.startsWith('Prise en charge')).toBe(true);
    expect(txt).toContain('2. Critère présent ?');
    expect(txt).toContain('   - Non : Voie B');
  });
});
