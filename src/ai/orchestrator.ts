/**
 * Point d'accès unique futur aux modèles et à la DB pour les flux IA.
 * Étape 1 : scaffold volontairement non fonctionnel.
 * Étape 2 doit brancher le classifieur AVANT tout appel LLM principal.
 */
export async function medInfoOrchestrator(): Promise<never> {
  throw new Error('MedInfo orchestrator is not implemented before the intent classifier gate.');
}
