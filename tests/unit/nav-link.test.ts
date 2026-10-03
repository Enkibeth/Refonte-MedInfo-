import { describe, expect, it } from 'vitest';

import { isModifiedClick, publicHref } from '@/ui/navHref';

describe('publicHref', () => {
  it('retire les groupes expo-router et garde la requête', () => {
    expect(publicHref('/(marketing)/blog')).toBe('/blog');
    expect(publicHref('/(chat)/chat?bot=student')).toBe('/chat?bot=student');
    expect(publicHref('/(billing)/pricing')).toBe('/pricing');
    expect(publicHref('/')).toBe('/');
    expect(publicHref('/(chat)/dashboard')).toBe('/dashboard');
    expect(publicHref('/admin')).toBe('/admin');
  });
});

describe('isModifiedClick', () => {
  it('laisse au navigateur les clics qui ouvrent un onglet ou une fenêtre', () => {
    expect(isModifiedClick({ ctrlKey: true })).toBe(true);
    expect(isModifiedClick({ metaKey: true })).toBe(true);
    expect(isModifiedClick({ shiftKey: true })).toBe(true);
    expect(isModifiedClick({ button: 1 })).toBe(true);
  });

  it('garde la navigation interne pour un clic simple ou le clavier', () => {
    expect(isModifiedClick({ button: 0 })).toBe(false);
    expect(isModifiedClick({})).toBe(false);
    expect(isModifiedClick(undefined)).toBe(false);
  });
});
