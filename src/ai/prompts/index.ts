/**
 * Registry des prompts actifs par persona (04_CHATBOT §11).
 * Seuls public et student sont activés en MVP (ADR-0006).
 * Changement de prompt actif = ADR obligatoire.
 */
import type { Persona, PromptArtifact } from './_schema';
import { publicPromptV2 } from './public.v2';

const activePrompts: Partial<Record<Persona, PromptArtifact>> = {
  public: publicPromptV2,
  // student: studentPromptV2, — ajouté à l'étape 6
  // professional: — REPORTÉ M6-M9, cf ADR-0006
};

export function getActivePrompt(persona: Persona): PromptArtifact {
  const prompt = activePrompts[persona];
  if (!prompt) {
    throw new Error(
      `No active prompt for persona "${persona}". Professional is deferred (ADR-0006); student is étape 6.`,
    );
  }
  return prompt;
}
