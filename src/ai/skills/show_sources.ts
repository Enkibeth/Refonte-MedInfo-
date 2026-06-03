/**
 * Skill show_sources — panneau de sources (04_CHATBOT §8, §9).
 * Tous personas. Citations issues du contexte LLM (RAG à l'étape 5).
 * db_access: false, regulatory_scope: non-MDSW.
 */
import { z } from 'zod';
import { tool } from 'ai';

export const allowed_personas = ['public', 'student', 'professional'] as const;
export const db_access = false;
export const regulatory_scope = 'non-MDSW';

const CitationSchema = z.object({
  title: z.string().min(1).describe('Titre de la source'),
  emitter: z.string().min(1).describe('Émetteur (HAS, ANSM, OMS…)'),
  url: z.string().url().optional().describe('URL de la source'),
  excerpt: z.string().max(300).optional().describe('Extrait court'),
});

const inputSchema = z.object({
  citations: z
    .array(CitationSchema)
    .min(1)
    .describe('Liste des sources citées dans la réponse'),
});

export const showSourcesTool = tool({
  description:
    'Affiche le panneau de sources après une réponse substantielle. Jamais derrière un paywall.',
  inputSchema,
  execute: async (input) => ({ citations: input.citations }),
});
