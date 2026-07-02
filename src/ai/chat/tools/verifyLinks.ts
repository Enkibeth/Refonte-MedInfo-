/**
 * Outil `verify_source_links` — vérifie que les URLs que le modèle s'apprête à citer
 * dans la section SOURCES répondent réellement (anti-lien mort, anti-hallucination).
 *
 * Le modèle l'appelle UNE fois, juste avant de rédiger SOURCES, avec toutes les URLs
 * candidates ; toute URL cassée doit être remplacée (URL DOI, page officielle de niveau
 * supérieur) ou retirée. Requêtes sortantes bornées : URLs publiques nommées uniquement
 * (anti-SSRF, cf urlSafety.ts), HEAD puis repli GET, timeout court, 8 URLs max.
 */
import { tool } from 'ai';
import { z } from 'zod';
import { isSafePublicHttpUrl } from './urlSafety';

const FETCH_TIMEOUT_MS = 6_000;
export const MAX_URLS_PER_CALL = 8;

export type LinkCheckStatus = 'ok' | 'broken' | 'unreachable' | 'unsafe';

export interface LinkCheckResult {
  url: string;
  status: LinkCheckStatus;
  httpStatus?: number;
  finalUrl?: string;
}

/** Verdict d'un code HTTP : 2xx/3xx = ok ; 4xx/5xx = cassé. */
export function verdictForHttpStatus(status: number): Extract<LinkCheckStatus, 'ok' | 'broken'> {
  return status >= 200 && status < 400 ? 'ok' : 'broken';
}

async function checkOne(url: string, fetchImpl: typeof fetch): Promise<LinkCheckResult> {
  if (!isSafePublicHttpUrl(url)) return { url, status: 'unsafe' };

  const attempt = async (method: 'HEAD' | 'GET'): Promise<LinkCheckResult> => {
    const res = await fetchImpl(url, {
      method,
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'user-agent': 'MedInfo-LinkCheck/1.0 (+https://medinfo.fr)' },
    });
    // On ne lit jamais le corps : seuls le statut et l'URL finale nous intéressent.
    try {
      await res.body?.cancel();
    } catch {
      /* certains runtimes ont déjà consommé/fermé le flux */
    }
    return {
      url,
      status: verdictForHttpStatus(res.status),
      httpStatus: res.status,
      finalUrl: res.url && res.url !== url ? res.url : undefined,
    };
  };

  try {
    const head = await attempt('HEAD');
    // Beaucoup de serveurs refusent HEAD (405/501, parfois 403) : re-vérifier en GET
    // avant de déclarer le lien cassé.
    if (head.status === 'broken') return await attempt('GET');
    return head;
  } catch {
    try {
      return await attempt('GET');
    } catch {
      return { url, status: 'unreachable' };
    }
  }
}

/** Formate les verdicts en liste actionnable par le modèle (pur, testé). */
export function formatLinkCheckResults(results: LinkCheckResult[]): string {
  const lines = results.map((r) => {
    switch (r.status) {
      case 'ok':
        return `${r.url} → OK (${r.httpStatus})${r.finalUrl ? ` — redirigé vers ${r.finalUrl}` : ''}`;
      case 'broken':
        return `${r.url} → CASSÉ (HTTP ${r.httpStatus}) — remplace cette URL (DOI, page officielle de niveau supérieur) ou retire la source`;
      case 'unsafe':
        return `${r.url} → REFUSÉ (URL non publique ou malformée) — ne cite jamais cette URL`;
      default:
        return `${r.url} → INJOIGNABLE (réseau/timeout) — préfère une URL plus stable si possible`;
    }
  });
  const broken = results.filter((r) => r.status !== 'ok').length;
  const summary =
    broken === 0
      ? 'Toutes les URLs répondent : tu peux les citer.'
      : `${broken} URL(s) à corriger avant de rédiger la section SOURCES.`;
  return `${lines.join('\n')}\n${summary}`;
}

export function verifySourceLinksTool(fetchImpl: typeof fetch = fetch) {
  return tool({
    description:
      "Vérifie que des URLs répondent réellement (statut HTTP, redirections) avant de les citer. " +
      "Appelle cet outil UNE SEULE fois, juste avant de rédiger la section SOURCES, avec TOUTES les URLs que tu prévois de citer. " +
      'Toute URL cassée doit être remplacée par une URL vérifiée (DOI, page officielle) ou la source retirée.',
    inputSchema: z.object({
      urls: z
        .array(z.string())
        .min(1)
        .max(MAX_URLS_PER_CALL)
        .describe('Les URLs candidates de la section SOURCES'),
    }),
    execute: async ({ urls }: { urls: string[] }) => {
      const unique = [...new Set(urls)].slice(0, MAX_URLS_PER_CALL);
      const results = await Promise.all(unique.map((u) => checkOne(u, fetchImpl)));
      return formatLinkCheckResults(results);
    },
  });
}
