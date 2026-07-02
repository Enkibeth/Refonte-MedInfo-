/**
 * Interprétation des erreurs de /api/chat côté client (ADR-0029) — module pur.
 *
 * Le transport useChat expose le corps de la réponse d'erreur dans `error.message`
 * (texte brut, souvent du JSON). On en dérive un type d'erreur exploitable par
 * l'UI : quota atteint (429, pas de bouton Réessayer — réessayer reconsommerait
 * le quota), inscription requise (401 invité), ou générique (bannière existante).
 */

export type ChatApiError =
  | { kind: 'rate_limited'; resetAt: string | null }
  | { kind: 'signup_required' }
  | { kind: 'generic' };

export function parseChatApiError(message: string | undefined | null): ChatApiError {
  const raw = (message ?? '').slice(0, 2000);
  if (!raw) return { kind: 'generic' };

  let parsed: Record<string, unknown> | null = null;
  const start = raw.indexOf('{');
  if (start !== -1) {
    try {
      parsed = JSON.parse(raw.slice(start)) as Record<string, unknown>;
    } catch {
      parsed = null;
    }
  }

  const errorCode = typeof parsed?.error === 'string' ? parsed.error : null;
  if (errorCode === 'rate_limited' || raw.includes('rate_limited')) {
    const resetAt =
      typeof parsed?.reset_at === 'string'
        ? parsed.reset_at
        : (raw.match(/"reset_at"\s*:\s*"([^"]+)"/)?.[1] ?? null);
    return { kind: 'rate_limited', resetAt };
  }
  if (errorCode === 'signup_required' || raw.includes('signup_required')) {
    return { kind: 'signup_required' };
  }
  return { kind: 'generic' };
}

/** « 23:00 » à partir d'un ISO, ou null si la date est invalide/absente. */
export function formatResetTime(resetAt: string | null): string | null {
  if (!resetAt) return null;
  const date = new Date(resetAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}
