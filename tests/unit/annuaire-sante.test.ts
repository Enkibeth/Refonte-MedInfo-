import { describe, it, expect } from 'vitest';

import { lookupRpps } from '@/auth/annuaireSante';

/**
 * Vérification RPPS via Annuaire Santé FHIR (ADR-0007/0011, 06_BILLING §10.2).
 * `fetch` injecté → aucun appel réseau réel.
 */
describe('lookupRpps', () => {
  it('interroge le bon endpoint FHIR avec le RPPS et la clé API', async () => {
    let captured: { url: string; init: RequestInit } | null = null;
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      captured = { url: String(url), init: init ?? {} };
      return new Response(JSON.stringify({ total: 1, entry: [{}] }), {
        status: 200,
        headers: { 'Content-Type': 'application/fhir+json' },
      });
    }) as unknown as typeof fetch;

    const result = await lookupRpps('10101234567', { apiKey: 'k_test', fetchImpl });

    expect(result).toEqual({ found: true });
    expect(captured!.url).toContain('/Practitioner?identifier=');
    expect(captured!.url).toContain(encodeURIComponent('http://rpps.fr|10101234567'));
    const headers = captured!.init.headers as Record<string, string>;
    expect(headers['ESANTE-API-KEY']).toBe('k_test');
  });

  it('renvoie found=false pour un bundle vide (RPPS inconnu/radié)', async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ total: 0 }), { status: 200 })) as unknown as typeof fetch;
    expect(await lookupRpps('00000000000', { apiKey: 'k', fetchImpl })).toEqual({ found: false });
  });

  it('lève une erreur si l’Annuaire Santé répond non-2xx', async () => {
    const fetchImpl = (async () => new Response('nope', { status: 503 })) as unknown as typeof fetch;
    await expect(lookupRpps('10101234567', { apiKey: 'k', fetchImpl })).rejects.toThrow(/503/);
  });
});
