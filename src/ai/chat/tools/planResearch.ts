/**
 * Outil `plan_research` — annonce du plan de recherche (concepts médicaux clés +
 * requêtes prévues) AVANT les recherches, à la Vera Health/OpenEvidence.
 *
 * Outil purement DÉTERMINISTE et local (aucun réseau, aucun appel LLM) : sa seule
 * fonction est de rendre VISIBLE l'étape « identification des concepts clés » dans la
 * timeline de progression du client (data part `data-research`). Pour ne coûter AUCUN
 * tour supplémentaire à la boucle agentique (latence ~15-18 s/étape en prod), le prompt
 * impose de l'appeler EN PARALLÈLE des premières recherches, dans le même tour.
 */
import { tool } from 'ai';
import { z } from 'zod';

import type { ResearchEvent } from '@/ai/chat/researchTimeline';

export const MAX_PLAN_CONCEPTS = 6;
export const MAX_PLAN_QUERIES = 4;

/** Confirmation renvoyée au modèle (pur, testé). */
export function formatPlanResearchResult(concepts: string[], queries: string[]): string {
  return (
    `Plan enregistré (${concepts.length} concept(s), ${queries.length} requête(s)). ` +
    `Poursuis : lance les recherches prévues, lis les résumés des articles retenus, vérifie les liens, puis rédige.`
  );
}

export function planResearchTool(onEvent?: (e: ResearchEvent) => void) {
  return tool({
    description:
      'Annonce ton plan de recherche : les concepts médicaux clés identifiés dans la question et les requêtes que tu vas lancer. ' +
      "Affiché à l'utilisateur pendant qu'il attend — ne remplace AUCUNE recherche. " +
      'Appelle-le UNE seule fois, EN PARALLÈLE de tes premières recherches (dans le MÊME tour, jamais un tour dédié).',
    inputSchema: z.object({
      concepts: z
        .array(z.string().min(1))
        .min(1)
        .max(MAX_PLAN_CONCEPTS)
        .describe('Concepts médicaux clés de la question (2 à 4 en général, dans la langue de l’utilisateur)'),
      queries: z
        .array(z.string().min(1))
        .min(1)
        .max(MAX_PLAN_QUERIES)
        .describe('Requêtes de recherche prévues (littérature en anglais, web selon le contexte)'),
    }),
    execute: async ({ concepts, queries }: { concepts: string[]; queries: string[] }) => {
      onEvent?.({ kind: 'plan', concepts, queries });
      return formatPlanResearchResult(concepts, queries);
    },
  });
}
