/**
 * Pas de doublon entre une puce de score suggérée (`<!--CALC:…-->`, chatbot pro) et une carte
 * d'outil Scores sur le même score (ADR-0044) : la consigne demande au modèle de ne pas
 * cumuler les deux, mais il le fait parfois (constaté avec CURB-65). La puce, qui ouvre déjà
 * le calculateur, l'emporte.
 *
 * Côté client seulement : résout le nom de score via le catalogue (src/scores), que la route
 * serveur n'a pas à embarquer. Module pur : tests/unit/chat-card-dedupe.test.ts.
 */
import { scoreIdForCalc, type ChatModuleAction } from '@/ai/chat/moduleActions';
import { findScoreForRequest } from '@/scores';

/** Identifiants de scores déjà proposés par des puces CALC (seulement ceux du catalogue). */
export function calcScoreIds(calcIds: string[]): Set<string> {
  const out = new Set<string>();
  for (const id of calcIds) {
    const scoreId = scoreIdForCalc(id);
    if (scoreId) out.add(scoreId);
  }
  return out;
}

/** Retire les cartes Scores qui désignent un score déjà couvert par une puce. */
export function withoutCalcDuplicates(actions: ChatModuleAction[], covered: Set<string>): ChatModuleAction[] {
  if (covered.size === 0) return actions;
  return actions.filter((action) => {
    if (action.tool !== 'scores' || !action.param) return true;
    const score = findScoreForRequest(action.param);
    return !score || !covered.has(score.id);
  });
}
