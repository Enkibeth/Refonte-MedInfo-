/**
 * Types de la garde d'entrée du chat (ADR-0029).
 *
 * Politique SANS sur-refus (leçon ADR-0023) : seuls `emergency` et
 * `personal_symptoms` manifestes bloquent ; tout le reste (y compris le doute)
 * passe au LLM principal, dont le prompt produit v3 porte la couche de prudence.
 */

export type GuardCategory =
  | 'emergency'
  | 'personal_symptoms'
  | 'general_info'
  | 'educational_case'
  | 'out_of_scope'
  | 'ambiguous';

/** Résultat de l'étage 1 (regex déterministe, local, <5 ms). */
export interface RegexGuardResult {
  category: Extract<GuardCategory, 'emergency' | 'personal_symptoms' | 'general_info' | 'out_of_scope'>;
  /** Premier motif ayant matché (audit/logs, jamais montré à l'utilisateur). */
  matchedMarker: string;
}

/**
 * Étage 2 — relecture LLM d'un hit `personal_symptoms` de l'étage 1.
 * Il ne peut que DÉGRADER vers « pas personnel » (faux positif regex) — jamais
 * escalader. `reformulations` : questions d'INFORMATION GÉNÉRALE proposées à
 * l'utilisateur en cas de refus (jamais un conseil, jamais adressées « vous »).
 */
export type LlmGuardCheck = (message: string) => Promise<{
  personal: boolean;
  reformulations?: string[];
}>;

export interface GuardVerdict {
  category: GuardCategory;
  /** true UNIQUEMENT pour emergency / personal_symptoms confirmé. */
  blocked: boolean;
  /** Couche qui a tranché (audit → ai_interactions.guardrail_layer). */
  layer: 'regex' | 'llm' | 'none';
  /** Motif regex ayant matché (audit uniquement). */
  marker?: string;
  /** Reformulations générales proposées par l'étage 2 (refus personal_symptoms). */
  reformulations?: string[];
}
