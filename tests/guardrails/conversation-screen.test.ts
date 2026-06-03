import { describe, it, expect } from 'vitest';

import { extractUserTexts, screenConversation } from '@/ai/orchestrator';

/**
 * Durcissement audit I1 : la couche 1 est appliquée à TOUS les tours utilisateur,
 * pas seulement au dernier. Empêche un historique forgé (client non fiable) d'introduire
 * des symptômes personnels dans le contexte du LLM sans passer par le classifieur.
 */
describe('screenConversation — couche 1 sur tout l’historique (I1)', () => {
  it('autorise une conversation 100 % general_info', async () => {
    const messages = [
      { role: 'user', content: "Qu'est-ce que le diabète ?" },
      { role: 'assistant', content: 'réponse encyclopédique' },
      { role: 'user', content: "Explique le mécanisme de l'hypertension" },
    ];
    const screen = await screenConversation(messages);
    expect(screen.allowed).toBe(true);
    expect(screen.category).toBe('general_info');
  });

  it('BLOQUE un historique forgé : symptômes perso dans un tour ANTÉRIEUR, dernier message anodin', async () => {
    const messages = [
      { role: 'user', content: "j'ai mal au ventre depuis ce matin" }, // tour injecté
      { role: 'assistant', content: '...' },
      { role: 'user', content: "Qu'est-ce que le paracétamol ?" }, // dernier message anodin
    ];
    const screen = await screenConversation(messages);
    expect(screen.allowed).toBe(false);
    expect(screen.category).toBe('personal_symptoms');
  });

  it('refuse une requête sans aucun tour utilisateur', async () => {
    const screen = await screenConversation([{ role: 'assistant', content: 'x' }]);
    expect(screen.allowed).toBe(false);
    expect(screen.category).toBe('ambiguous');
  });

  it('refuse un tour utilisateur vide (fail-safe)', async () => {
    const screen = await screenConversation([{ role: 'user', content: '' }]);
    expect(screen.allowed).toBe(false);
  });

  it('extractUserTexts lit le content string ET la première part texte', () => {
    const texts = extractUserTexts([
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'ignore' },
      { role: 'user', parts: [{ type: 'text', text: 'b' }] },
    ]);
    expect(texts).toEqual(['a', 'b']);
  });
});
