/**
 * Registry des prompts actifs par persona (04_CHATBOT §11).
 * Changement de prompt actif = ADR obligatoire.
 *
 * ⚠️  CONVENTION : quand tu ajoutes un nouveau persona ou prompt système,
 * enregistre-le dans src/admin/index.ts (AI_FEATURES) et dans
 * src/ai/prompts/promptStore.ts (PROMPT_DEFAULTS).
 */
import type { Persona, PromptArtifact } from './_schema';
import { publicPromptV2 } from './public.v2';
import { studentPromptV2 } from './student.v2';
import { professionalPromptV1 } from './professional.v1';

const activePrompts: Record<Persona, PromptArtifact> = {
  public: publicPromptV2,
  student: studentPromptV2,
  professional: professionalPromptV1,
};

export function getActivePrompt(persona: Persona): PromptArtifact {
  return activePrompts[persona];
}
