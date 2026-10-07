/**
 * Passage de relais du chat vers un outil (2026-10, ADR-0044) — en MÉMOIRE de l'onglet.
 *
 * Le chat dépose une demande (« ouvre Partiels avec ce fichier », « présélectionne ce score »)
 * puis navigue ; l'écran de l'outil la reprend une seule fois, qu'il soit déjà monté (onglet
 * conservé par le navigateur) ou qu'il monte à l'instant. Rien ne transite par l'URL ni par
 * un serveur : un fichier de notes reste un objet du navigateur, jamais téléversé.
 *
 * Une demande non reprise expire (`HANDOFF_TTL_MS`) : un outil ouvert bien plus tard, par un
 * autre chemin, ne doit pas recevoir une demande oubliée.
 *
 * ⚠️ Module PUR (pas de React) : tests/unit/chat-module-handoff.test.ts.
 */
import type { ChatModuleAction } from '@/ai/chat/moduleActions';

/** Fichier du navigateur (File) sans dépendre des types DOM côté serveur/tests. */
export interface HandoffFile {
  readonly name: string;
  readonly size: number;
  readonly type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export type ModuleHandoff =
  | { tool: 'partiel'; file: HandoffFile }
  | { tool: 'scores'; query: string }
  | { tool: 'ecos'; query: string }
  | { tool: 'presentation'; topic: string };

export type HandoffTool = ModuleHandoff['tool'];
export type HandoffFor<T extends HandoffTool> = Extract<ModuleHandoff, { tool: T }>;

/** Durée de validité d'une demande non reprise. */
export const HANDOFF_TTL_MS = 60_000;

const pending = new Map<HandoffTool, { handoff: ModuleHandoff; at: number }>();
const listeners = new Map<HandoffTool, Set<() => void>>();

/** Dépose une demande pour un outil (remplace une demande précédente non reprise). */
export function offerHandoff(handoff: ModuleHandoff, now: number = Date.now()): void {
  pending.set(handoff.tool, { handoff, at: now });
  for (const listener of listeners.get(handoff.tool) ?? []) listener();
}

/** Reprend (et retire) la demande en attente pour cet outil, si elle n'a pas expiré. */
export function takeHandoff<T extends HandoffTool>(tool: T, now: number = Date.now()): HandoffFor<T> | null {
  const entry = pending.get(tool);
  if (!entry) return null;
  pending.delete(tool);
  if (now - entry.at > HANDOFF_TTL_MS) return null;
  return entry.handoff as HandoffFor<T>;
}

/** Prévient l'écran d'un outil déjà monté qu'une demande vient d'arriver. */
export function subscribeHandoff(tool: HandoffTool, listener: () => void): () => void {
  let set = listeners.get(tool);
  if (!set) {
    set = new Set();
    listeners.set(tool, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
  };
}

/** Vide tout (tests). */
export function resetHandoffs(): void {
  pending.clear();
  listeners.clear();
}

/** Demande à déposer pour une carte d'action du chat, ou null (ouverture simple). */
export function handoffForAction(action: ChatModuleAction): ModuleHandoff | null {
  if (!action.param) return null;
  switch (action.tool) {
    case 'scores':
      return { tool: 'scores', query: action.param };
    case 'ecos':
      return { tool: 'ecos', query: action.param };
    case 'presentation':
      return { tool: 'presentation', topic: action.param };
    default:
      return null;
  }
}
