/**
 * Poursuite de la génération après déconnexion du client (`src/server/keepAlive.ts`).
 *
 * Enjeu depuis la migration Node (2026-08) : le processus reste vivant, donc la génération
 * continue toute seule. Ce qui doit être garanti ici, c'est qu'une promesse détachée qui
 * ÉCHOUE ne fasse pas tomber le processus — un `unhandledRejection` couperait le service
 * pour tous les utilisateurs à cause d'un seul onglet fermé.
 */
import { describe, expect, it, vi } from 'vitest';

import { keepAlive } from '@/server/keepAlive';

describe('keepAlive', () => {
  it('prend en charge une promesse et rend la main immédiatement', () => {
    let resolved = false;
    const promise = new Promise<void>((resolve) =>
      setTimeout(() => {
        resolved = true;
        resolve();
      }, 5),
    );

    expect(keepAlive(promise)).toBe(true);
    // Aucune attente : la réponse utilisateur ne doit jamais être retardée.
    expect(resolved).toBe(false);
    return promise;
  });

  it('neutralise un rejet sans laisser passer d’unhandledRejection', async () => {
    const onUnhandled = vi.fn();
    process.on('unhandledRejection', onUnhandled);
    try {
      expect(keepAlive(Promise.reject(new Error('génération interrompue')))).toBe(true);
      // Deux tours de boucle : Node signale les rejets non gérés en fin de microtâches.
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));
      expect(onUnhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('accepte tout thenable (consumeStream renvoie un PromiseLike)', () => {
    expect(keepAlive({ then: (resolve: () => void) => resolve() } as PromiseLike<unknown>)).toBe(
      true,
    );
  });

  it('ignore ce qui n’est pas un thenable', () => {
    expect(keepAlive(undefined as unknown as PromiseLike<unknown>)).toBe(false);
    expect(keepAlive({} as PromiseLike<unknown>)).toBe(false);
  });
});
