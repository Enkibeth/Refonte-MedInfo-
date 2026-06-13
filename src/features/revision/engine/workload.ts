/**
 * Conversion volumes → minutes de travail — PUR et déterministe.
 *
 * Règle : aucun volume n'est inventé. On convertit ce que l'étudiant a saisi
 * (pages / chapitres / QCM) en temps via sa vitesse personnelle déclarée.
 */
import type { RevisionItem, SpeedProfile } from './types';

/** Minutes pour `amount` unités à `perHour` unités/heure. 0 si débit ≤ 0. */
export function unitMinutes(amount: number, perHour: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (!Number.isFinite(perHour) || perHour <= 0) return 0;
  return (amount / perHour) * 60;
}

export interface ItemRemaining {
  pages: number;
  chapters: number;
  qcm: number;
}

/** Volumes restants d'un bloc (jamais négatifs : un dépassement de saisie est ignoré). */
export function itemRemaining(item: RevisionItem): ItemRemaining {
  return {
    pages: Math.max(0, item.pages - item.completedPages),
    chapters: Math.max(0, item.chapters - item.completedChapters),
    qcm: Math.max(0, item.qcm - item.completedQcm),
  };
}

/** Minutes totales d'un bloc complet (référence pour la progression). */
export function itemTotalMinutes(item: RevisionItem, speed: SpeedProfile): number {
  return (
    unitMinutes(item.pages, speed.pagesPerHour) +
    unitMinutes(item.chapters, speed.chaptersPerHour) +
    unitMinutes(item.qcm, speed.qcmPerHour)
  );
}

/** Minutes restantes d'un bloc (ce qu'il reste à faire). */
export function itemRemainingMinutes(item: RevisionItem, speed: SpeedProfile): number {
  const r = itemRemaining(item);
  return (
    unitMinutes(r.pages, speed.pagesPerHour) +
    unitMinutes(r.chapters, speed.chaptersPerHour) +
    unitMinutes(r.qcm, speed.qcmPerHour)
  );
}

export function totalMinutes(items: RevisionItem[], speed: SpeedProfile): number {
  return items.reduce((sum, it) => sum + itemTotalMinutes(it, speed), 0);
}

export function totalRemainingMinutes(items: RevisionItem[], speed: SpeedProfile): number {
  return items.reduce((sum, it) => sum + itemRemainingMinutes(it, speed), 0);
}

/** Progression globale 0–100 (minutes faites / minutes totales). 100 si rien à faire. */
export function progressPercent(items: RevisionItem[], speed: SpeedProfile): number {
  const total = totalMinutes(items, speed);
  if (total <= 0) return 100;
  const remaining = totalRemainingMinutes(items, speed);
  const done = Math.max(0, total - remaining);
  return Math.round((done / total) * 100);
}
