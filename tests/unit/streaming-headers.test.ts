/**
 * En-têtes des réponses en flux (`src/server/streamingHeaders.ts`).
 *
 * Régression invisible en local (Node ne tamponne rien) mais qui casse le chat en
 * production derrière un proxy/CDN : la réponse n'arriverait qu'à la fin.
 */
import { describe, expect, it } from 'vitest';

import { STREAMING_RESPONSE_HEADERS } from '@/server/streamingHeaders';

describe('STREAMING_RESPONSE_HEADERS', () => {
  it('interdit la transformation (recompression) et le cache par un intermédiaire', () => {
    expect(STREAMING_RESPONSE_HEADERS['Cache-Control']).toBe('no-cache, no-transform');
  });

  it('désactive la mise en tampon du proxy', () => {
    expect(STREAMING_RESPONSE_HEADERS['X-Accel-Buffering']).toBe('no');
  });

  it('remplace bien le Cache-Control par défaut de l’AI SDK (fusion insensible à la casse)', () => {
    // prepareHeaders (ai) : les en-têtes fournis priment, les défauts ne comblent que les
    // absents — vérifié ici avec la même sémantique que `Headers`.
    const merged = new Headers(STREAMING_RESPONSE_HEADERS);
    for (const [key, value] of Object.entries({ 'cache-control': 'no-cache', 'x-accel-buffering': 'no' })) {
      if (!merged.has(key)) merged.set(key, value);
    }
    expect(merged.get('cache-control')).toBe('no-cache, no-transform');
  });
});
