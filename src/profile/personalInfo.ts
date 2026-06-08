/**
 * Type partagé des informations personnelles de profil (prénom/nom/âge/sexe).
 * Module pur, sans dépendance : importable côté client (AuthProvider, écrans) ET serveur
 * (responseDirectives) pour garantir une source unique du contrat de données.
 *
 * Ce ne sont PAS des données de santé (cf. ADR-0021) : elles personnalisent l'information
 * générale, sans jamais ouvrir diagnostic/anamnèse/triage.
 */
export type Sex = 'feminin' | 'masculin' | 'autre' | 'non_precise';

export interface PersonalInfo {
  firstName?: string | null;
  lastName?: string | null;
  age?: number | null;
  sex?: Sex | null;
}

export const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'feminin', label: 'Féminin' },
  { value: 'masculin', label: 'Masculin' },
  { value: 'autre', label: 'Autre' },
  { value: 'non_precise', label: 'Non précisé' },
];

/** True si au moins un champ est renseigné. */
export function hasPersonalInfo(info: PersonalInfo | null | undefined): boolean {
  if (!info) return false;
  return Boolean(info.firstName || info.lastName || info.age != null || info.sex);
}
