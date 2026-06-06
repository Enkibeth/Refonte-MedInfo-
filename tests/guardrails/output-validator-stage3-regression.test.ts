import { describe, expect, it } from 'vitest';

import { CANONICAL_REFUSAL } from '@/compliance/disclosures';
import { validateOutput } from '@/ai/guardrails/outputValidator';

describe('outputValidator — régressions couche 3 complémentaires', () => {
  it.each([
    'VOUS AVEZ PROBABLEMENT une otite.',
    'Après analyse, votre diagnostic est une migraine.',
    "Il s'agit probablement de votre asthme.",
    'Votre maladie est un diabète.',
  ])('bloque les formulations diagnostiques malgré casse/contexte : %s', (text) => {
    const result = validateOutput(text);

    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.blockedMessage).toBe(CANONICAL_REFUSAL);
      expect(result.reason).toMatch(/Marqueur diagnostique individualisé/);
    }
  });

  it.each([
    'Le diagnostic différentiel de la douleur thoracique inclut plusieurs causes et relève d’un professionnel.',
    'Vous pouvez préparer vos questions pour une consultation médicale.',
    'Une migraine est une affection neurologique fréquente décrite dans les sources de référence.',
  ])('ne bloque pas les formulations générales sans attribution individualisée : %s', (text) => {
    expect(validateOutput(text)).toEqual({ blocked: false });
  });
});
