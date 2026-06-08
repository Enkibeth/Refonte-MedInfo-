import { describe, expect, it } from 'vitest';

import {
  REFLECTION_CLOSE,
  REFLECTION_OPEN,
  splitReflection,
} from '@/ai/ui/reflection';

describe('splitReflection', () => {
  it('renvoie le texte tel quel quand il n\'y a pas de bloc', () => {
    const { body, reflection, streaming } = splitReflection('Réponse simple.');
    expect(body).toBe('Réponse simple.');
    expect(reflection).toBeNull();
    expect(streaming).toBe(false);
  });

  it('extrait un bloc complet et nettoie les marqueurs', () => {
    const text = `Corps de réponse.\n\n${REFLECTION_OPEN}\nJe suis confiant, mais vérifiez auprès d'un médecin.\n${REFLECTION_CLOSE}`;
    const { body, reflection, streaming } = splitReflection(text);
    expect(body).toBe('Corps de réponse.');
    expect(reflection).toBe("Je suis confiant, mais vérifiez auprès d'un médecin.");
    expect(streaming).toBe(false);
    expect(body).not.toContain(REFLECTION_OPEN);
  });

  it('gère un bloc en cours de streaming (close absent)', () => {
    const text = `Corps.${REFLECTION_OPEN}\nRéflexion partielle`;
    const { body, reflection, streaming } = splitReflection(text);
    expect(body).toBe('Corps.');
    expect(reflection).toBe('Réflexion partielle');
    expect(streaming).toBe(true);
  });
});
