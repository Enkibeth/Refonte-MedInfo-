/**
 * Étage 2 de la garde d'entrée — relecture LLM d'un hit `personal_symptoms`
 * de l'étage 1 (feature key: "chat_guard", configurable panel admin).
 *
 * Rôle INVERSÉ par rapport à l'ancien classifieur (ADR-0029) : il ne peut que
 * DÉGRADER un faux positif regex vers « pas personnel » — jamais escalader.
 * En cas d'erreur/timeout, l'appelant conserve le verdict regex (fail-closed
 * sur la branche personnelle uniquement).
 *
 * Bonus UX : quand le refus est confirmé, l'étage 2 propose jusqu'à 3
 * reformulations en questions d'information générale, affichées comme options
 * cliquables sous le refus canonique (le refus n'est jamais un cul-de-sac).
 *
 * ⚠️  CONVENTION : le modèle utilisé (feature key: "chat_guard") est configurable
 * depuis le panel admin (app/(admin)/index.tsx) — déclaré dans src/admin/index.ts.
 */
import { generateObject } from 'ai';
import { z } from 'zod';

import { getRuntimeForFeature } from '@/ai/providers/featureRuntime';
import { getPromptTemplate } from '@/ai/prompts/promptStore';
import type { LlmGuardCheck } from './types';

/** Budget temps de l'étage 2 (amendement ADR-0029) : au-delà, verdict regex conservé. */
export const GUARD_LLM_TIMEOUT_MS = 1_500;

const guardSchema = z.object({
  personal: z.boolean(),
  reformulations: z.array(z.string().min(8).max(160)).max(3).optional(),
});

/**
 * Construit la relecture LLM. Toute erreur (clé absente, réseau, timeout,
 * sortie invalide) REMONTE à l'appelant, qui conserve le verdict regex.
 */
export function createGuardLlmCheck(): LlmGuardCheck {
  return async (message: string) => {
    const [system, runtime] = await Promise.all([
      getPromptTemplate('chat_guard'),
      getRuntimeForFeature('chat_guard'),
    ]);
    // Appel structuré : les outils (web search…) sont écartés, comme chat-meta.
    const { tools: _tools, ...callOptions } = runtime.options;

    const { object } = await generateObject({
      model: runtime.model,
      system,
      schema: guardSchema,
      prompt: message.slice(0, 2000),
      abortSignal: AbortSignal.timeout(GUARD_LLM_TIMEOUT_MS),
      ...callOptions,
    });

    return {
      personal: object.personal,
      reformulations: object.reformulations?.filter((q) => q.trim().length > 0),
    };
  };
}
