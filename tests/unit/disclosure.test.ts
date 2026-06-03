import { describe, it, expect } from 'vitest';

import { getAiDisclosure, DEFAULT_AI_SYSTEM_LABEL } from '@/compliance/disclosures';

/**
 * Correction audit I3 : la disclosure AI Act (art. 50) doit refléter le ou les systèmes
 * réellement servis. Le projet utilise DEUX providers (Anthropic + OpenAI) → la forme par
 * défaut nomme les deux ; la forme paramétrée injecte le modèle actif (contexte serveur).
 */
describe('getAiDisclosure — disclosure AI Act multi-provider (I3)', () => {
  it('par défaut, nomme les DEUX providers (Anthropic + OpenAI)', () => {
    const text = getAiDisclosure();
    expect(text).toContain('Anthropic');
    expect(text).toContain('OpenAI');
    expect(text).toContain('intelligence artificielle');
    expect(text).toContain(DEFAULT_AI_SYSTEM_LABEL);
  });

  it('mentionne que les réponses peuvent contenir des erreurs', () => {
    expect(getAiDisclosure()).toContain('peuvent contenir des erreurs');
  });

  it('injecte le libellé du modèle actif quand il est fourni (contexte serveur)', () => {
    const text = getAiDisclosure('claude-sonnet-4-6, Anthropic');
    expect(text).toContain('(claude-sonnet-4-6, Anthropic)');
    expect(text).not.toContain('OpenAI');
  });
});
