/** Photographies d’illustration ; provenance et licences : assets/landing/README.md. */
export const LANDING_PHOTOS = {
  study: 'Trois étudiants en médecine, en blouse blanche, échangent leurs notes dans un couloir.',
  work: 'Une professionnelle de santé consulte une tablette à son bureau.',
  sources: 'Une personne prend des notes en consultant des livres ouverts.',
  library: 'Deux étudiants révisent ensemble à une table de bibliothèque universitaire, devant un ordinateur portable et des livres ouverts.',
} as const;

export interface LandingPhotoProps {
  photo: keyof typeof LANDING_PHOTOS;
  /** L’espace est réservé avant le chargement de l’image. */
  aspectRatio?: number;
  priority?: boolean;
  sizes?: string;
  /** Rayon du cadre (défaut : rayon moyen du design system). */
  radius?: number;
  /** Web : point d'ancrage du recadrage (`object-position`), ex. « 50% 20% ». */
  position?: string;
}
