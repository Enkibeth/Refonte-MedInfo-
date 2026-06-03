/**
 * Skill render_qcm — QCM interactif sourcé (04_CHATBOT §8).
 * STUDENT UNIQUEMENT — jamais exposé au persona public (matrice 04_CHATBOT §8).
 * Activé à l'étape 6 (prompt student.v2).
 * db_access: false, regulatory_scope: non-MDSW · éducatif (cas fictifs).
 */
import { z } from 'zod';
import { tool } from 'ai';

export const allowed_personas = ['student'] as const;
export const db_access = false;
export const regulatory_scope = 'non-MDSW · éducatif (cas fictifs)';

const inputSchema = z.object({
  stem: z.string().min(10).describe('Énoncé de la question'),
  options: z.array(z.string().min(1)).length(5).describe('5 propositions (A à E)'),
  correct_index: z.number().int().min(0).max(4).describe('Index (0-4) de la bonne réponse'),
  explanation: z.string().min(10).describe('Explication sourcée de la bonne réponse'),
  item_edn: z.number().int().positive().describe('Numéro item EDN/R2C'),
  college: z.string().min(2).describe('Abréviation du Collège source'),
});

export const renderQcmTool = tool({
  description:
    'Affiche un QCM interactif sourcé sur un item EDN. Uniquement sur cas fictifs pédagogiques explicitement déclarés.',
  inputSchema,
  execute: async (input) => input,
});
