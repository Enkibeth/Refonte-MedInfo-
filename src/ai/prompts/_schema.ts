/**
 * Contrat des artefacts de prompt (04_CHATBOT §3).
 * Gate CI `prompt-contract` : vérifie la présence de regulatory_scope,
 * forbidden_outputs, mandatory_sections, eval_threshold dans chaque fichier.
 */

export type Persona = 'public' | 'student' | 'professional';

export type RegulatoryScope =
  | 'non-MDSW · information éducative générale'
  | 'non-MDSW · éducatif (cas fictifs)'
  | 'non-MDSW · référence documentaire';

export interface PromptArtifact {
  id: Persona;
  version: string;
  regulatory_scope: RegulatoryScope;
  model_default: string;
  contract: {
    forbidden_outputs: string[];
    mandatory_refusal_patterns: string[];
    mandatory_sections: string[];
  };
  eval_threshold: {
    factuality: number;
    sourcing: number;
    refusal_compliance: number;
  };
  template: string;
}
