/** Photographies d’illustration ; provenance et licences : assets/landing/README.md. */
export const LANDING_PHOTOS = {
  study: 'Deux étudiants échangent autour de livres et d’un ordinateur dans une bibliothèque.',
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
