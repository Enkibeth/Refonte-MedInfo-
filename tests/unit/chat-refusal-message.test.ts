import { describe, expect, it } from 'vitest';

import { buildRefusalText } from '@/ai/chat/guard/refusalMessage';
import { parseAssistantMessage } from '@/ai/chat/parseAssistantMessage';
import { CANONICAL_REFUSAL } from '@/compliance/disclosures';

describe('buildRefusalText — refus au format du contrat v3', () => {
  it('contient le refus canonique VERBATIM (source unique réglementaire)', () => {
    expect(buildRefusalText('personal_symptoms')).toContain(CANONICAL_REFUSAL);
    expect(buildRefusalText('emergency')).toContain(CANONICAL_REFUSAL);
  });

  it('urgence : redirection 15/112 en tête + options cliquables', () => {
    const text = buildRefusalText('emergency');
    expect(text).toMatch(/appelez le 15 \(SAMU\) ou le 112/);
    const parsed = parseAssistantMessage(text);
    const interaction = parsed.blocks.find((b) => b.type === 'interaction');
    expect(interaction).toBeDefined();
  });

  it('symptômes personnels : les reformulations de l’étage 2 deviennent des options cliquables', () => {
    const text = buildRefusalText('personal_symptoms', {
      reformulations: [
        'Quelles sont les causes fréquentes d’une fièvre prolongée chez l’adulte ?',
        'Quand une fièvre doit-elle amener à consulter ?',
      ],
    });
    const parsed = parseAssistantMessage(text);
    const interaction = parsed.blocks.find((b) => b.type === 'interaction') as
      | { type: 'interaction'; groups: Array<{ options: string[] }> }
      | undefined;
    expect(interaction).toBeDefined();
    const options = interaction!.groups.flatMap((g) => g.options);
    expect(options).toContain('Quelles sont les causes fréquentes d’une fièvre prolongée chez l’adulte ?');
    expect(options.length).toBe(2);
  });

  it('sans reformulations : options génériques de repli (jamais de cul-de-sac)', () => {
    const parsed = parseAssistantMessage(buildRefusalText('personal_symptoms'));
    const interaction = parsed.blocks.find((b) => b.type === 'interaction') as
      | { type: 'interaction'; groups: Array<{ options: string[] }> }
      | undefined;
    expect(interaction).toBeDefined();
    expect(interaction!.groups.flatMap((g) => g.options).length).toBeGreaterThanOrEqual(2);
  });

  it('neutralise les crochets dans les reformulations (contrat v3 : [] = boutons)', () => {
    const text = buildRefusalText('personal_symptoms', {
      reformulations: ['Question [avec crochets] à neutraliser ?'],
    });
    expect(text).not.toContain('[Question [avec');
    const parsed = parseAssistantMessage(text);
    const interaction = parsed.blocks.find((b) => b.type === 'interaction');
    expect(interaction).toBeDefined();
  });
});
