import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Deux écrans Expo Router ne doivent jamais résoudre vers la même URL.
 *
 * Incident 2026-10 : `app/(admin)/index.tsx` et `app/index.tsx` répondaient tous deux à « / ».
 * Le pré-rendu web gardait la page Admin pour `dist/server/index.html` : l'accueil de
 * medinfo-ai.com était servi avec le titre « Admin » et `noindex, nofollow` (désindexation),
 * puis React levait l'erreur #418 en hydratant la vraie page d'accueil par-dessus.
 */
const APP_DIR = path.resolve(__dirname, '../../app');

function screens(dir: string, rel: string[] = []): string[][] {
  const out: string[][] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === 'api') continue;
      out.push(...screens(full, [...rel, name]));
    } else if (/\.tsx?$/.test(name) && !name.startsWith('_') && !name.startsWith('+') && !name.includes('+api')) {
      out.push([...rel, name.replace(/\.(web\.)?tsx?$/, '')]);
    }
  }
  return out;
}

/** URL d'un écran : groupes `(x)` retirés, `index` = racine du dossier. */
function urlOf(parts: string[]): string {
  const segs = parts.filter((p) => !/^\(.*\)$/.test(p) && p !== 'index');
  return '/' + segs.join('/');
}

describe('routes Expo Router', () => {
  it('aucune URL n’est servie par deux écrans', () => {
    const byUrl = new Map<string, string[]>();
    for (const parts of screens(APP_DIR)) {
      const url = urlOf(parts);
      byUrl.set(url, [...(byUrl.get(url) ?? []), parts.join('/')]);
    }
    const collisions = [...byUrl.entries()].filter(([, files]) => new Set(files).size > 1);
    expect(collisions).toEqual([]);
  });

  it('l’accueil « / » est bien app/index.tsx', () => {
    const home = screens(APP_DIR).filter((p) => urlOf(p) === '/').map((p) => p.join('/'));
    expect(home).toEqual(['index']);
  });
});
