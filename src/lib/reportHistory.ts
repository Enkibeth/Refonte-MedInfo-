/**
 * Historique LOCAL des comptes rendus générés (privacy-first, web only — cf.
 * src/lib/localStore.ts). Les CR peuvent contenir des informations de santé :
 * ils restent STRICTEMENT sur l'appareil de l'utilisateur (jamais envoyés à un
 * serveur MedInfo) et sont effaçables individuellement ou en bloc.
 */
import { readJSON, writeJSON } from './localStore';

export interface SavedReport {
  id: string;
  title: string;
  templateId: string;
  content: string;
  source: 'audio' | 'text';
  /** ISO date de génération. */
  date: string;
}

const KEY = 'medinfo.cr.history.v1';
const MAX = 50;

export function loadReports(): SavedReport[] {
  return readJSON<SavedReport[]>(KEY, []);
}

/** Insère ou met à jour un CR (par id), en tête, et tronque à MAX. */
export function saveReport(report: SavedReport): SavedReport[] {
  const next = [report, ...loadReports().filter((r) => r.id !== report.id)].slice(0, MAX);
  writeJSON(KEY, next);
  return next;
}

export function deleteReport(id: string): SavedReport[] {
  const next = loadReports().filter((r) => r.id !== id);
  writeJSON(KEY, next);
  return next;
}

export function clearReports(): SavedReport[] {
  writeJSON(KEY, []);
  return [];
}
