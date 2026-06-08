import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  annuaireConfigFromEnv,
  interpretBundle,
  verifyRpps,
} from '@/auth/annuaireSante';

/**
 * Vérification RPPS via l'API FHIR Annuaire Santé (ADR-0011). Aucun réseau réel : `fetch` est
 * injecté. Invariants : confirmation présence + droit d'exercice, et fail-closed sur erreur.
 */
function bundle(total: number, active?: boolean) {
  return {
    resourceType: 'Bundle',
    total,
    entry: total > 0 ? [{ resource: { resourceType: 'Practitioner', active } }] : [],
  };
}

function okResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

const CONFIG = { apiKey: 'key-test' };

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('verifyRpps — appel FHIR Annuaire Santé', () => {
  it('valide un RPPS présent et actif', async () => {
    const fetchImpl = vi.fn(async () => okResponse(bundle(1, true)));
    const res = await verifyRpps('12345678901', { ...CONFIG, fetchImpl });
    expect(res).toEqual({ status: 'verified' });
  });

  it('interroge la bonne URL (valeur seule par défaut) avec l’en-tête de clé', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => okResponse(bundle(1, true)));
    await verifyRpps('12345678901', {
      apiKey: 'key-test',
      baseUrl: 'https://gateway.example/fhir/v2',
      keyHeader: 'ESANTE-API-KEY',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://gateway.example/fhir/v2/Practitioner?identifier=12345678901');
    expect(init?.headers).toMatchObject({ 'ESANTE-API-KEY': 'key-test' });
  });

  it('utilise system|value quand un rppsSystem est fourni', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => okResponse(bundle(1, true)));
    await verifyRpps('12345678901', {
      apiKey: 'key-test',
      baseUrl: 'https://gateway.example/fhir/v2',
      rppsSystem: 'https://rpps.esante.gouv.fr',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const [url] = fetchImpl.mock.calls[0];
    expect(url).toBe(
      'https://gateway.example/fhir/v2/Practitioner?identifier=' +
        encodeURIComponent('https://rpps.esante.gouv.fr|12345678901'),
    );
  });

  it('refuse un RPPS introuvable (total = 0)', async () => {
    const fetchImpl = vi.fn(async () => okResponse(bundle(0)));
    const res = await verifyRpps('12345678901', { ...CONFIG, fetchImpl });
    expect(res.status).toBe('rejected');
  });

  it('refuse un praticien inactif (radié/suspendu, active=false)', async () => {
    const fetchImpl = vi.fn(async () => okResponse(bundle(1, false)));
    const res = await verifyRpps('12345678901', { ...CONFIG, fetchImpl });
    expect(res.status).toBe('rejected');
  });

  it('fail-closed (unavailable) sur statut HTTP non-2xx', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 503 }) as unknown as Response);
    const res = await verifyRpps('12345678901', { ...CONFIG, fetchImpl });
    expect(res.status).toBe('unavailable');
  });

  it('fail-closed (unavailable) si le réseau échoue', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down');
    });
    const res = await verifyRpps('12345678901', { ...CONFIG, fetchImpl });
    expect(res).toEqual({ status: 'unavailable', reason: 'network down' });
  });
});

describe('interpretBundle — lecture défensive', () => {
  it('accepte active absent (présent dans l’annuaire)', () => {
    expect(interpretBundle(bundle(1, undefined))).toEqual({ status: 'verified' });
  });
  it('rejette une ressource FHIR inattendue (unavailable)', () => {
    expect(interpretBundle({ resourceType: 'OperationOutcome' }).status).toBe('unavailable');
  });
});

describe('annuaireConfigFromEnv', () => {
  it('renvoie null sans clé', () => {
    vi.stubEnv('ANNUAIRE_SANTE_API_KEY', '');
    expect(annuaireConfigFromEnv()).toBeNull();
  });
  it('lit la clé et les overrides éventuels', () => {
    vi.stubEnv('ANNUAIRE_SANTE_API_KEY', 'k');
    vi.stubEnv('ANNUAIRE_SANTE_API_URL', 'https://h/fhir/v1');
    vi.stubEnv('ANNUAIRE_SANTE_API_KEY_HEADER', 'GRAVITEE-API-KEY');
    expect(annuaireConfigFromEnv()).toEqual({
      apiKey: 'k',
      baseUrl: 'https://h/fhir/v1',
      keyHeader: 'GRAVITEE-API-KEY',
    });
  });
  it('nettoie les guillemets/espaces collés par erreur dans la clé (sinon 401)', () => {
    vi.stubEnv('ANNUAIRE_SANTE_API_KEY', '  "abc-123"\n');
    expect(annuaireConfigFromEnv()?.apiKey).toBe('abc-123');
  });
  it('traite une clé vide après nettoyage comme absente', () => {
    vi.stubEnv('ANNUAIRE_SANTE_API_KEY', '   ""   ');
    expect(annuaireConfigFromEnv()).toBeNull();
  });
});
