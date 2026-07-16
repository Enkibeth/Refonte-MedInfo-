/**
 * Teinte de pastille par outil (refonte shell 2026-07, principe « dashboard »).
 *
 * Chaque outil porte une couleur douce stable dans toute l'app (cartes du
 * dashboard, panneau « Outils » de la tab bar, menu d'outils, activité récente) :
 * repère visuel immédiat, jamais l'unique porteur d'information (icône + libellé
 * toujours présents — cf. 05_DESIGN §8).
 *
 * Couche UI uniquement : la matrice de visibilité par rôle reste dans
 * src/ai/routing/featureVisibility.ts (module pur), l'autorisation côté serveur.
 */
import type { AppFeatureId } from '@/ai/routing/featureVisibility';
import { tokens } from '@/ui/tokens';

export type FeatureTint = { fg: string; bg: string };

/**
 * Répartition pensée par persona : les outils visibles ensemble pour un même
 * rôle ont des teintes distinctes (public : blue/teal ; étudiant : blue/green/
 * rose/amber/violet/teal/slate ; pro : blue/rose/violet/teal/slate).
 */
const FEATURE_TINTS: Record<AppFeatureId, FeatureTint> = {
  chat: tokens.colors.tints.blue,
  document: tokens.colors.tints.teal,
  ecos: tokens.colors.tints.green,
  partiel: tokens.colors.tints.rose,
  revision: tokens.colors.tints.amber,
  audio: tokens.colors.tints.rose,
  presentation: tokens.colors.tints.violet,
  'cv-builder': tokens.colors.tints.teal,
  article: tokens.colors.tints.slate,
  scores: tokens.colors.tints.indigo,
};

export function featureTint(id: AppFeatureId): FeatureTint {
  return FEATURE_TINTS[id] ?? tokens.colors.tints.blue;
}
