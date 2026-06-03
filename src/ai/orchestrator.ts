/**
 * Point d'accès unique aux flux IA.
 *
 * Étape 2 : le classifieur d'intention (couche 1 du safe-box) est branché ICI, AVANT
 * tout appel au LLM principal. Le chat complet, le RAG, l'auth et la persistance Supabase
 * restent hors périmètre à cette étape : `callMainLlm` n'est pas encore fourni, donc toute
 * intention `general_info` est routée sans réponse générée tant que le chat n'est pas câblé.
 */
import { runClassifierGate, type ClassifierGateOptions, type ClassifierGateOutcome } from './classifier/gate';

export async function medInfoOrchestrator(
  message: string,
  options: ClassifierGateOptions = {},
): Promise<ClassifierGateOutcome> {
  return runClassifierGate(message, options);
}
