export type Persona = 'public' | 'student' | 'professional';

export type PromptArtifact = {
  id: Persona;
  version: string;
  regulatory_scope: string;
  forbidden_outputs: string[];
  mandatory_sections: string[];
  eval_threshold: number;
  system: string;
  enabledInMvp: boolean;
};
