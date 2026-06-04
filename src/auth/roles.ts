/**
 * Catalogue des rôles (personas) et vérifications (ADR-0011).
 * Pur et testable — aucune dépendance réseau, aucune donnée de santé.
 *
 * Règle sécurité (ADR-0011) : `persona`/`status` ne sont jamais auto-attribués côté client ;
 * la vérification + l'écriture se font côté serveur (`/api/role`, service_role).
 */
import type { Persona } from '@/ai/prompts/_schema';

export type VerificationMethod = 'none' | 'academic_email' | 'rpps';

export interface RoleDef {
  persona: Persona;
  label: string;
  description: string;
  requiresVerification: boolean;
  method: VerificationMethod;
}

export const ROLES: Record<Persona, RoleDef> = {
  public: {
    persona: 'public',
    label: 'Grand public',
    description: "Information médicale générale. Aucun compte requis.",
    requiresVerification: false,
    method: 'none',
  },
  student: {
    persona: 'student',
    label: 'Étudiant en santé',
    description: 'Cas fictifs, QCM EDN. Vérification par email étudiant.',
    requiresVerification: true,
    method: 'academic_email',
  },
  professional: {
    persona: 'professional',
    label: 'Professionnel de santé',
    description: 'Accès professionnel. Vérification par numéro RPPS (Annuaire Santé).',
    requiresVerification: true,
    method: 'rpps',
  },
};

/**
 * Heuristique de domaine académique (FR + .edu). Volontairement conservatrice ; ne stocke
 * aucun document. Faux négatifs assumés (certaines facs ont des domaines non standard) →
 * itérable. Aucune donnée de santé.
 */
const ACADEMIC_EMAIL_PATTERNS: RegExp[] = [
  /@etu\.[a-z0-9.-]+\.[a-z]{2,}$/i,
  /@etudiant[.-][a-z0-9.-]+\.[a-z]{2,}$/i,
  /@univ-[a-z0-9-]+\.fr$/i,
  /@[a-z0-9-]+\.univ-[a-z0-9-]+\.fr$/i,
  /@ac-[a-z0-9-]+\.fr$/i,
  /\.edu$/i,
];

export function isAcademicEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return false;
  return ACADEMIC_EMAIL_PATTERNS.some((re) => re.test(e));
}

/** Format RPPS = 11 chiffres (validation de forme uniquement ; l'existence réelle = ANS). */
export function isValidRppsFormat(rpps: string): boolean {
  return /^\d{11}$/.test(rpps.trim());
}
