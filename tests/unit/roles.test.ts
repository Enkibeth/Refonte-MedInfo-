import { describe, it, expect } from 'vitest';

import { ROLES, isAcademicEmail, isValidRppsFormat } from '@/auth/roles';

/** Catalogue de rôles + vérifications (ADR-0011). Pur, aucune donnée santé. */
describe('roles — catalogue', () => {
  it('définit les 3 personas avec leur méthode de vérification', () => {
    expect(ROLES.public.requiresVerification).toBe(false);
    expect(ROLES.student.method).toBe('academic_email');
    expect(ROLES.professional.method).toBe('rpps');
  });
});

describe('isAcademicEmail', () => {
  it('accepte des domaines académiques FR/.edu', () => {
    for (const e of [
      'jean@etu.univ-lyon1.fr',
      'marie@etudiant.univ-paris.fr',
      'paul@univ-lille.fr',
      'lea@medecine.univ-amu.fr',
      'sam@ac-nantes.fr',
      'student@harvard.edu',
    ]) {
      expect(isAcademicEmail(e)).toBe(true);
    }
  });

  it('refuse les emails grand public et malformés', () => {
    for (const e of ['jean@gmail.com', 'x@yahoo.fr', 'pas-un-email', 'a@b', '']) {
      expect(isAcademicEmail(e)).toBe(false);
    }
  });
});

describe('isValidRppsFormat', () => {
  it('accepte 11 chiffres, refuse le reste', () => {
    expect(isValidRppsFormat('10101010101')).toBe(true);
    expect(isValidRppsFormat('123')).toBe(false);
    expect(isValidRppsFormat('abcdefghijk')).toBe(false);
    expect(isValidRppsFormat('101010101010')).toBe(false);
  });
});
