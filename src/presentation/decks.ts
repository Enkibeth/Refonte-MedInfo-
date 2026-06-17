/**
 * Validation/normalisation des présentations enregistrées (historique cloud, ADR-0026).
 *
 * Module PUR et testable : il borne et valide le payload venu de l'iframe AVANT
 * écriture en base (table `presentation_decks`, own-row RLS). Aucune donnée de santé
 * identifiable (un deck = un support d'information médicale générale).
 */

import { coerceUuid } from '@/db/ids';

/** Garde-fous de taille (un deck riche reste petit ; on borne large mais fini). */
export const MAX_TITLE_CHARS = 200;
export const MAX_DECK_JSON_CHARS = 200_000;
export const MAX_AI_HISTORY_JSON_CHARS = 200_000;
export const MAX_AI_HISTORY_MESSAGES = 80;

export type DeckTheme = 'v1' | 'v2' | 'v3';

export interface DeckHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface DeckPayload {
  title: string;
  theme: DeckTheme;
  deck: Record<string, unknown>;
  aiHistory: DeckHistoryMessage[];
}

export type SanitizeResult = { ok: true; value: DeckPayload } | { ok: false; error: string };

/** Id de présentation transmis par le client (uuid, sinon null). */
export function coerceDeckId(value: unknown): string | null {
  return coerceUuid(value);
}

export function coerceTheme(value: unknown): DeckTheme {
  return value === 'v1' || value === 'v3' ? value : 'v2';
}

export function coerceTitle(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE_CHARS);
}

function jsonSize(value: unknown): number {
  try {
    return JSON.stringify(value).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

/**
 * Normalise un tableau de messages `{role, content}` inconnu : ne garde que les rôles
 * user/assistant au contenu non vide, borne optionnellement la longueur de chaque
 * message (`maxChars`), puis conserve les `maxMessages` derniers. Partagé avec
 * `/api/presentation` (même forme `{role, content}`).
 */
export function coerceHistoryMessages(
  value: unknown,
  { maxMessages, maxChars }: { maxMessages: number; maxChars?: number },
): DeckHistoryMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((m): m is { role?: unknown; content?: unknown } => !!m && typeof m === 'object')
    .map((m) => {
      const content = typeof m.content === 'string' ? m.content : '';
      return {
        role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        content: maxChars ? content.slice(0, maxChars) : content,
      };
    })
    .filter((m) => m.content.length > 0)
    .slice(-maxMessages);
}

/**
 * Valide et borne le corps d'une sauvegarde de présentation. Échoue (ok:false) si le
 * deck est absent/illisible ou trop volumineux (garde-fou payload), sinon renvoie un
 * objet propre prêt à écrire.
 */
export function sanitizeDeckPayload(body: unknown): SanitizeResult {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;

  if (!b.deck || typeof b.deck !== 'object' || Array.isArray(b.deck)) {
    return { ok: false, error: 'deck requis (objet).' };
  }
  if (jsonSize(b.deck) > MAX_DECK_JSON_CHARS) {
    return { ok: false, error: 'deck trop volumineux.' };
  }

  const aiHistory = coerceHistoryMessages(b.aiHistory, { maxMessages: MAX_AI_HISTORY_MESSAGES });
  if (jsonSize(aiHistory) > MAX_AI_HISTORY_JSON_CHARS) {
    return { ok: false, error: 'historique trop volumineux.' };
  }

  // Titre : explicite, sinon dérivé du meta.title du deck.
  const deck = b.deck as Record<string, unknown>;
  const metaTitle = (deck.meta as { title?: unknown } | undefined)?.title;
  const title = coerceTitle(b.title) || coerceTitle(metaTitle) || 'Présentation sans titre';

  const theme = coerceTheme(b.theme ?? deck.theme);

  return { ok: true, value: { title, theme, deck, aiHistory } };
}
