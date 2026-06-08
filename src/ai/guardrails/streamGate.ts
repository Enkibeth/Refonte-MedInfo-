/**
 * Couche 3 du safe-box — variante STREAMING (validation incrémentale).
 *
 * Objectif : afficher la réponse de façon progressive (token par token) SANS dégrader
 * la garantie de la version bufferisée (04_CHATBOT §4, 01_REGULATION §4, ADR-0022).
 *
 * Principe (invariant de sûreté) :
 *  - On accumule le texte complet (`full`) au fil du flux.
 *  - À CHAQUE incrément, on valide le cumul AVANT toute émission.
 *  - On ne libère qu'un préfixe DÉJÀ validé, en gardant en réserve une marge
 *    (`MARGIN`) ≥ au plus long marqueur diagnostique : un marqueur en cours de
 *    formation reste donc non affiché tant qu'il n'est pas tranché.
 *  - Si le cumul est bloqué, on remplace par le refus canonique et on coupe la suite
 *    (texte restant + tool-calls show_sources/propose_followups supprimés).
 *
 * Équivalence de décision : `validateOutput` étant monotone (un marqueur présent dans
 * le texte final l'est dans un préfixe), ce gate BLOQUE exactement les mêmes réponses
 * que la validation bufferisée — seul le MOMENT change. Seule différence comportementale :
 * un préfixe validé (donc non diagnostique) a pu s'afficher avant le refus.
 */
import type { UIMessageChunk } from 'ai';

import { validateOutput } from '@/ai/guardrails/outputValidator';
import { buildRefusalChunks } from '@/ai/guardrails/refusalStream';

// Marge de sûreté (caractères gardés en réserve). Doit rester ≥ au plus long marqueur
// de outputValidator ("il s'agit probablement de votre" = 31). 48 laisse une réserve
// confortable tout en gardant les réponses courtes quasi instantanées.
export const SAFE_MARGIN = 48;

export interface GateReport {
  /** true si la couche 3 a remplacé la sortie par le refus canonique. */
  blocked: boolean;
  /** Texte LLM complet observé (pour le logging d'audit, sans le diffuser). */
  fullText: string;
}

type AnyChunk = UIMessageChunk & Record<string, unknown>;

/**
 * Filtre incrémental : consomme le flux UI-message d'origine et ré-émet le texte par
 * préfixes validés, ou le refus canonique si un marqueur diagnostique apparaît.
 * Pur (aucun accès SDK Response) → entièrement testable avec des chunks synthétiques.
 */
export async function* gateUiMessageStream(
  source: AsyncIterable<UIMessageChunk>,
  genId: () => string,
  report: GateReport,
): AsyncGenerator<UIMessageChunk> {
  let full = '';
  let released = 0;
  let blocked = false;
  let openTextId: string | undefined;

  for await (const raw of source) {
    if (blocked) continue; // refus déjà émis : on draine la source sans rien diffuser.

    const chunk = raw as AnyChunk;
    const type = chunk.type as string;

    if (type === 'text-start') {
      openTextId = chunk.id as string;
      yield raw;
      continue;
    }

    if (type === 'text-delta') {
      full += (chunk.delta as string) ?? '';
      if (validateOutput(full).blocked) {
        blocked = true;
        if (openTextId) {
          yield { type: 'text-end', id: openTextId } as unknown as UIMessageChunk;
          openTextId = undefined;
        }
        for (const rc of buildRefusalChunks('output_validation', genId)) yield rc;
        continue;
      }
      const safeEnd = Math.max(released, full.length - SAFE_MARGIN);
      if (safeEnd > released) {
        yield {
          ...(chunk as object),
          type: 'text-delta',
          delta: full.slice(released, safeEnd),
        } as unknown as UIMessageChunk;
        released = safeEnd;
      }
      continue;
    }

    if (type === 'text-end') {
      if (validateOutput(full).blocked) {
        blocked = true;
        for (const rc of buildRefusalChunks('output_validation', genId)) yield rc;
        openTextId = undefined;
        continue;
      }
      if (full.length > released) {
        yield {
          ...(chunk as object),
          type: 'text-delta',
          delta: full.slice(released),
        } as unknown as UIMessageChunk;
        released = full.length;
      }
      openTextId = undefined;
      yield raw; // ferme la part texte
      continue;
    }

    // tool-calls, data-parts, framing (start/finish/step) : transmis tels quels, dans
    // l'ordre. Atteint uniquement hors état bloqué (sinon supprimés par le `continue`).
    yield raw;
  }

  report.blocked = blocked;
  report.fullText = full;
}
