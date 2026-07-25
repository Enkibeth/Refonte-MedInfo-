/**
 * Maintien en vie de la génération après déconnexion du client (`src/server/keepAlive.ts`).
 *
 * Enjeu : sans `waitUntil`, quitter le navigateur pendant une réponse gèle l'invocation
 * serverless — la réponse n'est jamais archivée et l'utilisateur ne la retrouve nulle part.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { VERCEL_REQUEST_CONTEXT, keepAlive } from '@/server/keepAlive';

const g = globalThis as unknown as Record<symbol, unknown>;

afterEach(() => {
  delete g[VERCEL_REQUEST_CONTEXT];
});

describe('keepAlive', () => {
  it('confie la promesse au waitUntil de la plateforme', async () => {
    const waitUntil = vi.fn();
    g[VERCEL_REQUEST_CONTEXT] = { get: () => ({ waitUntil }) };

    const work = Promise.resolve('archivé');
    expect(keepAlive(work)).toBe(true);
    expect(waitUntil).toHaveBeenCalledTimes(1);
    await expect(waitUntil.mock.calls[0][0]).resolves.toBeUndefined();
  });

  it('neutralise un rejet : une promesse détachée ne doit pas tuer le processus', async () => {
    const waitUntil = vi.fn();
    g[VERCEL_REQUEST_CONTEXT] = { get: () => ({ waitUntil }) };

    keepAlive(Promise.reject(new Error('modèle indisponible')));
    await expect(waitUntil.mock.calls[0][0]).resolves.toBeUndefined();
  });

  it('accepte un thenable (consumeStream ne renvoie pas une vraie Promise)', () => {
    const waitUntil = vi.fn();
    g[VERCEL_REQUEST_CONTEXT] = { get: () => ({ waitUntil }) };

    // `consumeStream()` de l'AI SDK est typé `PromiseLike`, pas `Promise`.
    const thenable = { then: () => undefined } as unknown as PromiseLike<unknown>;
    expect(keepAlive(thenable)).toBe(true);
  });

  it('est un no-op hors plateforme (dev local, tests) sans jamais lever', () => {
    expect(keepAlive(Promise.resolve())).toBe(false);

    g[VERCEL_REQUEST_CONTEXT] = { get: () => undefined };
    expect(keepAlive(Promise.resolve())).toBe(false);

    g[VERCEL_REQUEST_CONTEXT] = {
      get: () => {
        throw new Error('contexte illisible');
      },
    };
    expect(keepAlive(Promise.resolve())).toBe(false);
  });

  it('refuse ce qui n’est pas une promesse plutôt que de planter la route', () => {
    const waitUntil = vi.fn();
    g[VERCEL_REQUEST_CONTEXT] = { get: () => ({ waitUntil }) };

    expect(keepAlive(undefined as never)).toBe(false);
    expect(keepAlive({} as never)).toBe(false);
    expect(waitUntil).not.toHaveBeenCalled();
  });
});
