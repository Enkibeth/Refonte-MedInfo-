import { describe, it, expect } from 'vitest';

import { buildRefusalChunks } from '@/ai/guardrails/refusalStream';
import { CANONICAL_REFUSAL } from '@/compliance/disclosures';

/**
 * Durcissement audit I2 : le refus déterministe est émis comme tool-call
 * `refuse_and_redirect` (format de flux UI-message), pour s'AFFICHER chez l'utilisateur
 * — et non comme un JSON que useChat ne sait pas rendre. Source unique : CANONICAL_REFUSAL.
 */
describe('buildRefusalChunks — refus affiché en flux (I2)', () => {
  it('émet un tool-call refuse_and_redirect portant le CANONICAL_REFUSAL', () => {
    let n = 0;
    const chunks = buildRefusalChunks('personal_symptoms', () => `id-${n++}`);

    const input = chunks.find((c) => c.type === 'tool-input-available') as any;
    const output = chunks.find((c) => c.type === 'tool-output-available') as any;

    expect(input).toBeDefined();
    expect(output).toBeDefined();
    expect(input.toolName).toBe('refuse_and_redirect');
    // Le toolCallId relie l'input à l'output (même appel d'outil).
    expect(input.toolCallId).toBe(output.toolCallId);
    expect(output.output.message).toBe(CANONICAL_REFUSAL);
    expect(output.output.reason).toBe('personal_symptoms');
  });
});
