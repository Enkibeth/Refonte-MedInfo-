import { describe, it, expect } from 'vitest';

import { isConversationalTurn, latestUserText } from '@/ai/chat/turnKind';

describe('isConversationalTurn — tours purement conversationnels (→ prompt allégé)', () => {
  it('reconnaît les salutations et politesses simples', () => {
    for (const t of [
      'bonjour',
      'Bonjour !',
      'MERCI',
      'merci beaucoup',
      'ok',
      "d'accord",
      'parfait',
      'au revoir',
      'bonjour docteur',
      'bonjour merci',
      'non merci',
    ]) {
      expect(isConversationalTurn(t), t).toBe(true);
    }
  });
});

describe('isConversationalTurn — tours SUBSTANTIELS (→ prompt complet + outils, sécurité)', () => {
  it('toute question ou tout chiffre rend le tour substantiel', () => {
    for (const t of [
      'ça va ?',
      "j'ai 40 ans",
      'et pour un enfant ?',
      'quelle dose de doliprane',
      "c'est quoi le diabète",
      "bonjour, j'ai une douleur dans la poitrine depuis ce matin",
      'merci mais quels sont les effets indésirables',
      '',
      '   ',
    ]) {
      expect(isConversationalTurn(t), t).toBe(false);
    }
  });

  it('ne se laisse pas piéger par une salutation suivie d’une demande médicale', () => {
    expect(isConversationalTurn('bonjour docteur mal au ventre intense')).toBe(false);
  });

  it('défensif sur les entrées non-string', () => {
    expect(isConversationalTurn(undefined as unknown as string)).toBe(false);
    expect(isConversationalTurn(null as unknown as string)).toBe(false);
  });
});

describe('latestUserText — extraction défensive du dernier message utilisateur', () => {
  it('lit le texte des parts du dernier message user', () => {
    const messages = [
      { role: 'user', parts: [{ type: 'text', text: 'bonjour' }] },
      { role: 'assistant', parts: [{ type: 'text', text: 'Bonjour, comment puis-je aider ?' }] },
      { role: 'user', parts: [{ type: 'text', text: 'merci' }] },
    ];
    expect(latestUserText(messages)).toBe('merci');
  });

  it('lit le champ content string si présent', () => {
    expect(latestUserText([{ role: 'user', content: 'ok' }])).toBe('ok');
  });

  it('renvoie une chaîne vide si aucun message utilisateur ou forme inattendue', () => {
    expect(latestUserText([])).toBe('');
    expect(latestUserText(null)).toBe('');
    expect(latestUserText([{ role: 'assistant', parts: [{ type: 'text', text: 'x' }] }])).toBe('');
  });
});
