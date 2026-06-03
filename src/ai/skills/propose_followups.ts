/**
 * Skill propose_followups — boutons de suite (04_CHATBOT §8).
 * Tous personas. Suggestions GÉNÉRIQUES, jamais personnelles.
 * db_access: false, regulatory_scope: non-MDSW.
 */
import { z } from 'zod';
import { tool } from 'ai';

export const allowed_personas = ['public', 'student', 'professional'] as const;
export const db_access = false;
export const regulatory_scope = 'non-MDSW';

const inputSchema = z.object({
  suggestions: z
    .array(z.string().min(1).max(120))
    .min(2)
    .max(4)
    .describe('Sujets génériques à proposer (jamais personnels)'),
});

export const proposeFollowupsTool = tool({
  description:
    'Propose 2-4 sujets connexes génériques à explorer. Jamais personnels, jamais anamnestiques.',
  inputSchema,
  execute: async (input) => ({ suggestions: input.suggestions }),
});
