/**
 * Conversion volumes → charge de travail (minutes) — module PUR et déterministe.
 *
 * Règle safe-box : aucun chiffre n'est inventé. La charge dérive UNIQUEMENT des volumes
 * saisis (pages / chapitres / QCM) et du rythme personnel de l'étudiant. L'IA ne calcule
 * jamais ces valeurs (testé dans tests/unit/revision-planner.test.ts).
 */
import type { RevisionResource, SpeedProfile, TaskType } from '@/revision/types';

/**
 * Minutes pour un volume donné à un rythme donné.
 * Si le volume est nul, ou le rythme non renseigné (<= 0), la contribution est 0 :
 * on ne peut pas estimer sans rythme, et on ne fabrique pas de chiffre arbitraire.
 */
function minutesFor(count: number, perHour: number): number {
  if (count <= 0 || perHour <= 0) return 0;
  return (count / perHour) * 60;
}

/** Charge (minutes) d'une ressource, somme de ses trois composantes. */
export function resourceMinutes(resource: RevisionResource, speed: SpeedProfile): number {
  return (
    minutesFor(resource.pages, speed.pagesPerHour) +
    minutesFor(resource.chapters, speed.chaptersPerHour) +
    minutesFor(resource.qcm, speed.qcmPerHour)
  );
}

/** Charge totale (minutes) de toutes les ressources, hors buffer. */
export function totalWorkloadMinutes(resources: RevisionResource[], speed: SpeedProfile): number {
  return resources.reduce((sum, r) => sum + resourceMinutes(r, speed), 0);
}

/** Applique la marge de sécurité (buffer) à une charge en minutes. */
export function withBuffer(minutes: number, bufferRatio: number): number {
  return minutes * (1 + Math.max(0, bufferRatio));
}

/** Type de tâche dominant d'une ressource (composante la plus lourde en minutes). */
export function dominantTaskType(resource: RevisionResource, speed: SpeedProfile): TaskType {
  const buckets: Array<[TaskType, number]> = [
    ['reading', minutesFor(resource.pages, speed.pagesPerHour)],
    ['chapters', minutesFor(resource.chapters, speed.chaptersPerHour)],
    ['qcm', minutesFor(resource.qcm, speed.qcmPerHour)],
  ];
  buckets.sort((a, b) => b[1] - a[1]);
  return buckets[0][1] > 0 ? buckets[0][0] : 'custom';
}
