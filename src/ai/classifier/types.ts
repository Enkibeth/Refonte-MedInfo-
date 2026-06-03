/**
 * Classifieur d'intention — couche 1 du safe-box (07_CLASSIFIER, 01_REGULATION §4).
 * Les 5 catégories sont contractuelles : elles doivent rester strictement alignées
 * avec 04_CHATBOT §3 (IntentCategory) et la table de logging ai_interactions.
 */
export type IntentCategory =
  | 'general_info'
  | 'personal_symptoms'
  | 'emergency'
  | 'out_of_scope'
  | 'ambiguous';

/** Étage ayant produit la décision (audit `classifier_decisions.layer`). */
export type ClassifierLayer = 'regex' | 'llm' | 'fallback';

export type ClassifierResult = {
  category: IntentCategory;
  /** 0.0–1.0. Le regex déterministe renvoie une confiance élevée et figée. */
  confidence: number;
  layer: ClassifierLayer;
  /** Marqueurs lexicaux ayant déclenché la catégorie (debug/audit, jamais de PII). */
  matchedMarkers?: string[];
};

/** Action de routage décidée à partir d'un ClassifierResult. */
export type ClassifierAction = 'route_main_llm' | 'refuse' | 'out_of_scope_reply';

export type ClassifierDecision = {
  action: ClassifierAction;
  /** Présent uniquement si action === 'refuse' : message canonique 01_REGULATION §4. */
  refusalMessage?: string;
};

/**
 * Contrat de l'étage 2 (LLM léger). NON câblé à l'étape 2 du projet :
 * interface injectable uniquement (cf décision produit). Sortie JSON imposée,
 * temperature=0 attendue côté implémentation future (07_CLASSIFIER §4).
 */
export type LlmStage2 = (
  message: string,
) => Promise<{ category: IntentCategory; confidence: number }>;
