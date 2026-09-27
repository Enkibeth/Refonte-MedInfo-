/**
 * Hooks d'hydratation (src/ui/hydration.ts, src/ui/useWindowWidth.ts) : le pré-rendu
 * statique doit toujours produire la valeur « serveur », quel que soit ce que le
 * navigateur saurait lire. Sinon le premier rendu client diffère du HTML pré-rendu :
 * erreur React #418, HTML jeté puis reconstruit (constaté sur / et /chat, 2026-09).
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', async () => await import('react-native-web'));

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Dimensions } from 'react-native';

import { useClientState } from '@/ui/hydration';
import { useWindowWidth } from '@/ui/useWindowWidth';

function Probe() {
  const [value, , ready] = useClientState(() => 'préférence-locale', 'défaut');
  const width = useWindowWidth();
  return createElement('output', null, `${value}|${ready ? 'prête' : 'en-attente'}|${width}`);
}

describe('pré-rendu statique', () => {
  it('rend la valeur par défaut et la largeur 0, jamais ce que lirait le navigateur', () => {
    const spy = vi.spyOn(Dimensions, 'get').mockReturnValue({ width: 1440, height: 900, scale: 1, fontScale: 1 });
    try {
      expect(renderToStaticMarkup(createElement(Probe))).toBe('<output>défaut|en-attente|0</output>');
    } finally {
      spy.mockRestore();
    }
  });
});
