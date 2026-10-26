import type { Persona } from '@/ai/prompts/_schema';

const AUDIENCE_LABEL: Record<Persona, string> = { public: 'Grand public', student: 'Étudiants', professional: 'Professionnels' };

/**
 * Repère du bandeau d'un outil (ADR-0047) : à qui l'outil est ouvert, d'après les personas du
 * registre `APP_FEATURES` (jamais une liste recopiée). Module pur, testé.
 */
export function audienceLabel(personas: readonly Persona[]): string {
  const names = (['public', 'student', 'professional'] as const).filter((p) => personas.includes(p)).map((p) => AUDIENCE_LABEL[p]);
  if (names.length === 0) return 'Outil MedInfo AI';
  if (names.length === 1) return `Outil · ${names[0]}`;
  return `Outil · ${names.slice(0, -1).join(', ')} et ${names[names.length - 1].toLowerCase()}`;
}
