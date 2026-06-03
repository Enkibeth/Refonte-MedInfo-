/**
 * Skill refuse_and_redirect — refus déterministe couche 2 (04_CHATBOT §4, 01_REGULATION §4).
 * Tous personas. Le message retourné est toujours CANONICAL_REFUSAL (source unique).
 * db_access: false, regulatory_scope: non-MDSW.
 */
import { z } from 'zod';
import { tool } from 'ai';

import { CANONICAL_REFUSAL } from '@/compliance/disclosures';

export const allowed_personas = ['public', 'student', 'professional'] as const;
export const db_access = false;
export const regulatory_scope = 'non-MDSW';

const inputSchema = z.object({
  reason: z
    .enum(['personal_symptoms', 'emergency', 'individual_advice', 'ambiguous'])
    .describe('Raison du refus'),
  redirect_target: z
    .enum(['doctor', 'emergency_services', 'pharmacist', 'mental_health'])
    .describe('Vers qui rediriger'),
});

export const refuseAndRedirectTool = tool({
  description:
    "Refus déterministe. À appeler si l'utilisateur décrit ses symptômes, demande une orientation ou une évaluation individuelle. Couche 2 du safe-box.",
  inputSchema,
  execute: async (input) => ({
    message: CANONICAL_REFUSAL,
    reason: input.reason,
    redirect_target: input.redirect_target,
  }),
});
