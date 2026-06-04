import { describe, expect, it } from 'vitest';

import { requiresMedicalGrounding } from '@/rag/grounding';

/**
 * ADR-0012 : le cite-or-refuse ne s'applique qu'aux demandes d'information factuelle.
 * Les messages purement conversationnels passent au LLM sans exiger de source RAG ; tout le
 * reste (et le moindre ajout médical) reste fail-safe → ancrage requis.
 */
describe('requiresMedicalGrounding — périmètre cite-or-refuse', () => {
  it('exempte les salutations et formules de politesse seules', () => {
    for (const text of ['Bonjour', 'bonsoir !', 'Salut', 'Merci beaucoup', 'ok', 'Au revoir']) {
      expect(requiresMedicalGrounding(text)).toBe(false);
    }
  });

  it('exempte les questions méta sur l’assistant', () => {
    for (const text of ['Qui es-tu ?', 'Que peux-tu faire ?', 'Comment ça marche ?', "C'est quoi MedInfo ?"]) {
      expect(requiresMedicalGrounding(text)).toBe(false);
    }
  });

  it('exige un ancrage pour toute question de santé', () => {
    for (const text of [
      'Quels sont les conseils pour le diabète de type 2 ?',
      'Précautions avec les anti-inflammatoires ?',
      'Que faire en cas de surpoids ?',
    ]) {
      expect(requiresMedicalGrounding(text)).toBe(true);
    }
  });

  it('reste fail-safe si une salutation est suivie d’un contenu médical', () => {
    expect(requiresMedicalGrounding('Bonjour, et pour le diabète ?')).toBe(true);
    expect(requiresMedicalGrounding('Merci, une dernière chose sur les AINS')).toBe(true);
  });

  it('exige un ancrage pour un message vide (fail-safe)', () => {
    expect(requiresMedicalGrounding('   ')).toBe(true);
  });
});
