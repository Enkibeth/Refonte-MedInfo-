/**
 * Porte d'entrée du safe-box (couche 1) : exécutée AVANT tout LLM principal.
 *
 * Garantie structurelle (01_REGULATION §4, 07_CLASSIFIER §1) : le callback `callMainLlm`
 * n'est invoqué QUE lorsque la décision est `route_main_llm` (c.-à-d. `general_info`
 * suffisamment confiant). Pour `personal_symptoms` / `emergency` / `ambiguous`, le LLM
 * principal n'est jamais appelé — le refus est rendu de façon déterministe.
 *
 * NB : aucun appel LLM réel, aucune persistance (Supabase reportée). Le hook d'audit
 * `classifier_decisions` (07_CLASSIFIER §7) sera branché à une étape ultérieure.
 */
import { classifyIntent, type ClassifyOptions } from './index';
import { resolveDecision } from './decision';
import type { ClassifierAction, ClassifierResult, IntentCategory } from './types';

export type ClassifierGateOptions = ClassifyOptions & {
  /** Appel du LLM principal. N'est exécuté que pour une décision `route_main_llm`. */
  callMainLlm?: (message: string) => Promise<string> | string;
};

export type ClassifierGateOutcome = {
  category: IntentCategory;
  action: ClassifierAction;
  result: ClassifierResult;
  /** Présent si action === 'refuse' : message canonique 01_REGULATION §4. */
  refusalMessage?: string;
  /** Présent si le LLM principal a été appelé (action === 'route_main_llm'). */
  response?: string;
};

export async function runClassifierGate(
  message: string,
  options: ClassifierGateOptions = {},
): Promise<ClassifierGateOutcome> {
  const result = await classifyIntent(message, { llmStage2: options.llmStage2 });
  const decision = resolveDecision(result);

  const outcome: ClassifierGateOutcome = {
    category: result.category,
    action: decision.action,
    result,
    refusalMessage: decision.refusalMessage,
  };

  if (decision.action === 'route_main_llm' && options.callMainLlm) {
    outcome.response = await options.callMainLlm(message);
  }

  return outcome;
}
