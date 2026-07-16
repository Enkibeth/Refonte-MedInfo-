/**
 * Catalogue complet des scores médicaux + métadonnées de catégories.
 * Source unique consommée par l'écran `app/(chat)/scores.tsx` et le moteur de
 * recherche `src/scores/search.ts`.
 */
import type { CategoryMeta, ScoreCategory, ScoreDefinition } from '../types';
import { CARDIO_SCORES } from './cardio';
import { THROMBOSE_SCORES } from './thrombose';
import { PNEUMO_SCORES } from './pneumo';
import { URGENCES_SCORES } from './urgences';
import { NEPHRO_SCORES } from './nephro';
import { HEPATO_SCORES } from './hepato';
import { NEURO_SCORES } from './neuro';
import { GERIATRIE_SCORES } from './geriatrie';
import { ANESTHESIE_SCORES } from './anesthesie';
import { GENERAL_SCORES } from './general';

/** Ordre d'affichage des catégories + icône (src/ui/iconPaths.ts). */
export const CATEGORIES: CategoryMeta[] = [
  { id: 'cardio', label: 'Cardiologie', icon: 'heart' },
  { id: 'thrombose', label: 'Thrombose / MTEV', icon: 'droplet' },
  { id: 'pneumo', label: 'Pneumo / Infectio', icon: 'wind' },
  { id: 'urgences', label: 'Urgences / Réa', icon: 'activity' },
  { id: 'nephro', label: 'Néphro / Métabolique', icon: 'testTube' },
  { id: 'hepato', label: 'Hépato-gastro', icon: 'pill' },
  { id: 'neuro', label: 'Neurologie', icon: 'brain' },
  { id: 'geriatrie', label: 'Gériatrie', icon: 'personStanding' },
  { id: 'anesthesie', label: 'Anesthésie', icon: 'moon' },
  { id: 'general', label: 'Général', icon: 'scale' },
];

/** Tous les scores, groupés par catégorie dans l'ordre de `CATEGORIES`. */
export const ALL_SCORES: ScoreDefinition[] = [
  ...CARDIO_SCORES,
  ...THROMBOSE_SCORES,
  ...PNEUMO_SCORES,
  ...URGENCES_SCORES,
  ...NEPHRO_SCORES,
  ...HEPATO_SCORES,
  ...NEURO_SCORES,
  ...GERIATRIE_SCORES,
  ...ANESTHESIE_SCORES,
  ...GENERAL_SCORES,
];

const CATEGORY_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export function categoryMeta(id: ScoreCategory): CategoryMeta {
  const meta = CATEGORY_BY_ID.get(id);
  if (!meta) throw new Error(`Catégorie de score inconnue : ${id}`);
  return meta;
}

export function categoryLabel(id: ScoreCategory): string {
  return CATEGORY_BY_ID.get(id)?.label ?? id;
}

export function getScore(id: string): ScoreDefinition | undefined {
  return ALL_SCORES.find((s) => s.id === id);
}

/** Nombre de scores par catégorie (pour les chips de navigation). */
export function countByCategory(): Record<ScoreCategory, number> {
  const counts = Object.fromEntries(CATEGORIES.map((c) => [c.id, 0])) as Record<ScoreCategory, number>;
  for (const s of ALL_SCORES) counts[s.category] += 1;
  return counts;
}
