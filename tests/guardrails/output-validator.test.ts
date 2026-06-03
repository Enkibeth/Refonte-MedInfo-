import { describe, expect, it } from 'vitest';

import { validateOutput } from '@/ai/guardrails/outputValidator';
import { CANONICAL_REFUSAL } from '@/compliance/disclosures';

/**
 * Gate `refusal-regression` — couche 3 : validation de sortie LLM.
 * 03_SECURITY §5, 04_CHATBOT §4 : marqueurs diagnostiques individualisés → blocked.
 * La réponse est remplacée par CANONICAL_REFUSAL ; incident loggé.
 */
describe('outputValidator — couche 3 safe-box', () => {
  it.each([
    'Vous avez probablement une gastrite.',
    'vous avez probablement une infection.',
    "Votre maladie est l'hypertension artérielle.",
    "Votre diagnostic est confirme : c'est une appendicite.",
    'Vous souffrez de diabete de type 2.',
    "Vous êtes atteint d'une bronchite chronique.",
  ])('bloque la sortie avec marqueur diagnostique individualisé : %s', (text) => {
    const result = validateOutput(text);
    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toBeDefined();
      expect(result.blockedMessage).toBe(CANONICAL_REFUSAL);
    }
  });

  it.each([
    "L'hypertension est une maladie chronique caracterisee par une pression arterielle elevee.",
    'Le diabete de type 2 touche environ 4 millions de personnes en France. (Source : Sante Publique France 2023)',
    "L'appendicite est une inflammation de l'appendice vermiculaire.",
    'En cas de symptomes, consultez un professionnel de sante.',
    'La gastrite est generalement traitee par des inhibiteurs de la pompe a protons.',
  ])('laisse passer une reponse encyclopedique sans marqueur : %s', (text) => {
    const result = validateOutput(text);
    expect(result.blocked).toBe(false);
  });

  it('retourne le refus canonique exact (source unique 01_REGULATION §4)', () => {
    const result = validateOutput('Vous avez probablement un ulcere gastrique.');
    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.blockedMessage).toBe(CANONICAL_REFUSAL);
      expect(result.blockedMessage).toMatchInlineSnapshot(
        `"MedInfo AI fournit de l'information médicale générale et ne peut pas analyser une situation personnelle ni orienter un diagnostic individuel. Si vous ressentez des symptômes ou une inquiétude qui vous concerne, vous ou un proche, consultez un professionnel de santé. En cas d'urgence, composez le 15 (SAMU) ou le 112. En cas de détresse psychologique ou d'idées suicidaires, composez le 3114. Pour un besoin de soins non programmés, le 116 117 peut orienter selon votre territoire ; pour une pharmacie de garde, le 3237 peut être utile selon disponibilité locale."`,
      );
    }
  });
});
