/**
 * Tests des helpers de recherche d'images d'illustration du chat
 * (src/ai/chat/imageSearch.ts) : validation de requête, sélection du meilleur
 * résultat Google Custom Search, et gating de la section de prompt par la config.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildIllustrationSection,
  isImageSearchConfigured,
  normalizeImageQuery,
  pickImageResult,
} from '@/ai/chat/imageSearch';

describe('normalizeImageQuery', () => {
  it('nettoie et borne une requête valide', () => {
    expect(normalizeImageQuery('  knee joint\nanatomy   diagram ')).toBe('knee joint anatomy diagram');
  });

  it('rejette les valeurs vides, trop courtes ou non textuelles', () => {
    expect(normalizeImageQuery('')).toBeNull();
    expect(normalizeImageQuery('ab')).toBeNull();
    expect(normalizeImageQuery(null)).toBeNull();
    expect(normalizeImageQuery(42)).toBeNull();
  });

  it('tronque les requêtes trop longues à 160 caractères', () => {
    expect(normalizeImageQuery('x'.repeat(500))?.length).toBe(160);
  });
});

describe('pickImageResult', () => {
  const item = (over: Record<string, unknown> = {}) => ({
    link: 'https://example.org/schema.png',
    title: 'Schéma du genou',
    image: {
      contextLink: 'https://example.org/article',
      thumbnailLink: 'https://encrypted-tbn0.gstatic.com/images?q=abc',
      width: 800,
      height: 600,
    },
    ...over,
  });

  it('retourne la première image https exploitable', () => {
    const result = pickImageResult({ items: [item()] });
    expect(result).toEqual({
      url: 'https://example.org/schema.png',
      thumbnailUrl: 'https://encrypted-tbn0.gstatic.com/images?q=abc',
      title: 'Schéma du genou',
      contextUrl: 'https://example.org/article',
      width: 800,
      height: 600,
    });
  });

  it('écarte les liens non https et les vignettes minuscules', () => {
    const result = pickImageResult({
      items: [
        item({ link: 'http://insecure.org/img.png' }),
        item({ image: { width: 64, height: 64 } }),
        item({ link: 'https://example.org/ok.png' }),
      ],
    });
    expect(result?.url).toBe('https://example.org/ok.png');
  });

  it('retourne null sans résultat exploitable', () => {
    expect(pickImageResult(null)).toBeNull();
    expect(pickImageResult({})).toBeNull();
    expect(pickImageResult({ items: [] })).toBeNull();
    expect(pickImageResult({ items: [item({ link: 'http://insecure.org/a.png' })] })).toBeNull();
  });
});

describe('configuration (clé + cx serveur)', () => {
  const saved = {
    key: process.env.GOOGLE_SEARCH_API_KEY,
    cx: process.env.GOOGLE_SEARCH_ENGINE_ID,
  };

  afterEach(() => {
    if (saved.key === undefined) delete process.env.GOOGLE_SEARCH_API_KEY;
    else process.env.GOOGLE_SEARCH_API_KEY = saved.key;
    if (saved.cx === undefined) delete process.env.GOOGLE_SEARCH_ENGINE_ID;
    else process.env.GOOGLE_SEARCH_ENGINE_ID = saved.cx;
  });

  it('inactive sans clé ou sans cx → section de prompt vide (le modèle n’émet pas de marqueur)', () => {
    delete process.env.GOOGLE_SEARCH_API_KEY;
    delete process.env.GOOGLE_SEARCH_ENGINE_ID;
    expect(isImageSearchConfigured()).toBe(false);
    expect(buildIllustrationSection()).toBe('');

    process.env.GOOGLE_SEARCH_API_KEY = 'k';
    expect(isImageSearchConfigured()).toBe(false);
    expect(buildIllustrationSection()).toBe('');
  });

  it('active avec clé + cx → section ILLUSTRATIONS avec le marqueur IMG', () => {
    process.env.GOOGLE_SEARCH_API_KEY = 'k';
    process.env.GOOGLE_SEARCH_ENGINE_ID = 'cx';
    expect(isImageSearchConfigured()).toBe(true);
    const section = buildIllustrationSection();
    expect(section).toContain('ILLUSTRATIONS (IMAGES)');
    expect(section).toContain('<!--IMG:');
  });
});
