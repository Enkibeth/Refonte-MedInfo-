import { describe, it, expect } from 'vitest';

import {
  coerceDeckId,
  coerceTheme,
  coerceTitle,
  sanitizeDeckPayload,
  MAX_DECK_JSON_CHARS,
  MAX_TITLE_CHARS,
} from '@/presentation/decks';

describe('coerceDeckId', () => {
  it('accepte un uuid, rejette le reste', () => {
    expect(coerceDeckId('11111111-1111-1111-1111-111111111111')).toBe('11111111-1111-1111-1111-111111111111');
    expect(coerceDeckId('pas-un-uuid')).toBeNull();
    expect(coerceDeckId(42)).toBeNull();
    expect(coerceDeckId(null)).toBeNull();
  });
});

describe('coerceTheme / coerceTitle', () => {
  it('borne le thème aux valeurs connues (défaut v2)', () => {
    expect(coerceTheme('v1')).toBe('v1');
    expect(coerceTheme('v3')).toBe('v3');
    expect(coerceTheme('vX')).toBe('v2');
    expect(coerceTheme(undefined)).toBe('v2');
  });
  it('nettoie et borne le titre', () => {
    expect(coerceTitle('  Mon   sujet  ')).toBe('Mon sujet');
    expect(coerceTitle('x'.repeat(500)).length).toBe(MAX_TITLE_CHARS);
    expect(coerceTitle(123)).toBe('');
  });
});

describe('sanitizeDeckPayload', () => {
  it('rejette un deck absent ou non-objet', () => {
    expect(sanitizeDeckPayload({}).ok).toBe(false);
    expect(sanitizeDeckPayload({ deck: 'x' }).ok).toBe(false);
    expect(sanitizeDeckPayload({ deck: [] }).ok).toBe(false);
  });

  it('dérive le titre du deck.meta.title quand absent', () => {
    const r = sanitizeDeckPayload({ deck: { meta: { title: 'DAPA-HF' }, theme: 'v1', slides: [] } });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.title).toBe('DAPA-HF');
      expect(r.value.theme).toBe('v1');
      expect(r.value.aiHistory).toEqual([]);
    }
  });

  it('retient un titre par défaut si rien n\'est fourni', () => {
    const r = sanitizeDeckPayload({ deck: { slides: [] } });
    expect(r.ok && r.value.title).toBe('Présentation sans titre');
  });

  it('filtre et borne l\'historique IA', () => {
    const r = sanitizeDeckPayload({
      deck: { meta: { title: 'T' } },
      aiHistory: [
        { role: 'user', content: 'salut' },
        { role: 'assistant', content: '' },
        { role: 'weird', content: 'x' },
        null,
      ],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.aiHistory).toEqual([
        { role: 'user', content: 'salut' },
        { role: 'user', content: 'x' },
      ]);
    }
  });

  it('rejette un deck trop volumineux (garde-fou payload)', () => {
    const huge = { meta: { title: 'T' }, blob: 'x'.repeat(MAX_DECK_JSON_CHARS + 10) };
    expect(sanitizeDeckPayload({ deck: huge }).ok).toBe(false);
  });
});
