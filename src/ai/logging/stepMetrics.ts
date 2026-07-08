/**
 * Résumé des étapes de la boucle agentique du chat (balance rapidité/qualité 2026-07) :
 * nombre d'appels LLM (steps) et décompte d'appels par outil, à partir du tableau
 * `steps` fourni par l'AI SDK dans onFinish. Sert au diagnostic de latence dans
 * ai_interactions (migration 0034) — NOMS d'outils uniquement, jamais leurs arguments
 * ni aucun contenu de message (03_SECURITY §6).
 *
 * Module pur, défensif sur la forme des steps (elle varie selon la version de l'AI SDK) :
 * testé dans tests/unit/step-metrics.test.ts.
 */

export interface StepMetrics {
  /** Nombre d'étapes LLM de la boucle (1 = réponse directe sans outil). */
  steps: number;
  /** Décompte d'appels par nom d'outil (ex. { europe_pmc_search: 2, verify_source_links: 1 }). */
  toolCalls: Record<string, number>;
}

interface StepLike {
  toolCalls?: unknown;
  content?: unknown;
}

function toolNamesOfStep(step: StepLike): string[] {
  const names: string[] = [];
  const fromCalls = Array.isArray(step.toolCalls) ? step.toolCalls : [];
  for (const call of fromCalls) {
    const name = (call as { toolName?: unknown } | null)?.toolName;
    if (typeof name === 'string' && name) names.push(name);
  }
  if (names.length > 0) return names;
  // Repli : certains outils (ex. web_search exécuté par le provider) n'apparaissent que
  // dans le contenu de l'étape sous forme de parts `tool-call`.
  const content = Array.isArray(step.content) ? step.content : [];
  for (const part of content) {
    const p = part as { type?: unknown; toolName?: unknown } | null;
    if (p?.type === 'tool-call' && typeof p.toolName === 'string' && p.toolName) {
      names.push(p.toolName);
    }
  }
  return names;
}

/** Résume les steps de streamText ; null si la forme est inexploitable. */
export function summarizeSteps(steps: unknown): StepMetrics | null {
  if (!Array.isArray(steps) || steps.length === 0) return null;
  const toolCalls: Record<string, number> = {};
  for (const step of steps) {
    if (step == null || typeof step !== 'object') continue;
    for (const name of toolNamesOfStep(step as StepLike)) {
      toolCalls[name] = (toolCalls[name] ?? 0) + 1;
    }
  }
  return { steps: steps.length, toolCalls };
}
