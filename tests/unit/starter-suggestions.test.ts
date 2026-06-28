import { describe, it, expect } from 'vitest';

import {
  STARTER_SUGGESTIONS,
  SUGGESTIONS_VISIBLE_COUNT,
  suggestionWindow,
} from '@/chat/starterSuggestions';

const CHATBOTS = ['public', 'student', 'professional'] as const;

describe('starterSuggestions — banque de questions par chatbot', () => {
  it.each(CHATBOTS)('le chatbot %s dispose de 50 questions uniques et non vides', (bot) => {
    const list = STARTER_SUGGESTIONS[bot];
    expect(list).toHaveLength(50);
    expect(new Set(list).size).toBe(list.length);
    for (const q of list) expect(q.trim().length).toBeGreaterThan(0);
  });
});

describe('suggestionWindow — rotation 3 par 3', () => {
  const list = STARTER_SUGGESTIONS.public;

  it('retourne 3 questions par défaut', () => {
    expect(suggestionWindow(list, 0)).toHaveLength(SUGGESTIONS_VISIBLE_COUNT);
  });

  it('avance de 3 questions à chaque tick', () => {
    expect(suggestionWindow(list, 0)).toEqual(list.slice(0, 3));
    expect(suggestionWindow(list, 1)).toEqual(list.slice(3, 6));
  });

  it('boucle sur la liste (wrap-around) sans jamais être vide', () => {
    // 50 questions / 3 par fenêtre : le tick 16 (start = 48) chevauche fin et début.
    expect(suggestionWindow(list, 16)).toEqual([list[48], list[49], list[0]]);
    expect(suggestionWindow(list, 17)).toEqual([list[1], list[2], list[3]]);
    for (let tick = 0; tick < 120; tick++) {
      expect(suggestionWindow(list, tick)).toHaveLength(3);
    }
  });

  it('finit par montrer toutes les questions', () => {
    const seen = new Set<string>();
    for (let tick = 0; tick < 50; tick++) {
      for (const q of suggestionWindow(list, tick)) seen.add(q);
    }
    expect(seen.size).toBe(list.length);
  });

  it('tolère une liste plus courte que la fenêtre et une liste vide', () => {
    expect(suggestionWindow(['a', 'b'], 0)).toEqual(['a', 'b']);
    expect(suggestionWindow([], 5)).toEqual([]);
  });
});
