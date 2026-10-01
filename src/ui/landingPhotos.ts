/** Photographies d’illustration ; provenance et licences : assets/landing/README.md. */
export const LANDING_PHOTOS = {
  study: 'Trois étudiants en médecine, en blouse blanche, échangent leurs notes dans un couloir.',
  work: 'Une professionnelle de santé consulte une tablette à son bureau.',
  sources: 'Une personne prend des notes en consultant des livres ouverts.',
} as const;

export interface LandingPhotoProps {
  photo: keyof typeof LANDING_PHOTOS;
  /** L’espace est réservé avant le chargement de l’image. */
  aspectRatio?: number;
  priority?: boolean;
  sizes?: string;
}
