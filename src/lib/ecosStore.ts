/**
 * Persistance LOCALE des favoris et de l'historique de progression ECOS
 * (privacy-first, web only — cf. src/lib/localStore.ts). Cas FICTIFS uniquement
 * (ADR-0017) : aucune donnée de santé. Effaçable par l'utilisateur.
 */
import { readJSON, writeJSON } from './localStore';
import type { EcosSession } from './ecosProgress';

const FAV_KEY = 'medinfo.ecos.favorites.v1';
const SESS_KEY = 'medinfo.ecos.sessions.v1';
const MAX_SESSIONS = 200;

// ── Favoris ─────────────────────────────────────────────────────────────────
export function loadFavorites(): string[] {
  return readJSON<string[]>(FAV_KEY, []);
}

export function isFavorite(caseId: string): boolean {
  return loadFavorites().includes(caseId);
}

/** Bascule l'état favori d'un cas et renvoie la nouvelle liste. */
export function toggleFavorite(caseId: string): string[] {
  const cur = new Set(loadFavorites());
  if (cur.has(caseId)) cur.delete(caseId);
  else cur.add(caseId);
  const next = [...cur];
  writeJSON(FAV_KEY, next);
  return next;
}

// ── Historique de sessions ──────────────────────────────────────────────────
export function loadSessions(): EcosSession[] {
  return readJSON<EcosSession[]>(SESS_KEY, []);
}

/** Ajoute une session en tête (récent → ancien) et tronque à MAX_SESSIONS. */
export function addSession(session: EcosSession): EcosSession[] {
  const next = [session, ...loadSessions()].slice(0, MAX_SESSIONS);
  writeJSON(SESS_KEY, next);
  return next;
}

export function clearSessions(): EcosSession[] {
  writeJSON(SESS_KEY, []);
  return [];
}
