/**
 * Émission d'un refus déterministe dans le format de flux UI-message (AI SDK v6),
 * pour qu'il s'AFFICHE réellement chez l'utilisateur (correctif audit I2).
 *
 * Auparavant la couche 1 renvoyait un JSON `{type:'refusal'}` que `useChat` ne sait pas
 * rendre → bannière d'erreur générique. On émet désormais le refus comme un tool-call
 * `refuse_and_redirect` (même rendu natif que la couche 2), porteur du CANONICAL_REFUSAL
 * (source unique, 01_REGULATION §4).
 */
import type { UIMessageChunk } from 'ai';

import { CANONICAL_REFUSAL } from '@/compliance/disclosures';

/**
 * Construit les chunks UI d'un refus `refuse_and_redirect`. Pur et testable (pas de SDK
 * Response) : le handler n'a plus qu'à `writer.write(...)` chaque chunk.
 */
export function buildRefusalChunks(reason: string, genId: () => string): UIMessageChunk[] {
  const toolCallId = genId();
  const payload = {
    reason,
    redirect_target: 'health_professional',
    message: CANONICAL_REFUSAL,
  };

  return [
    {
      type: 'tool-input-available',
      toolCallId,
      toolName: 'refuse_and_redirect',
      input: { reason, redirect_target: 'health_professional' },
    },
    {
      type: 'tool-output-available',
      toolCallId,
      output: payload,
    },
  ];
}
