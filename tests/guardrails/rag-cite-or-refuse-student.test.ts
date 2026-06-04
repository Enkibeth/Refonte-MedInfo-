import { describe, expect, it } from 'vitest';

import { getActivePrompt } from '@/ai/prompts/index';
import { buildRagSystemSection, retrieveLocalRagChunks, RAG_REFUSAL_MESSAGE } from '@/rag/retrieval';

describe('non-régression RAG cite-or-refuse avec student.v2', () => {
  it('conserve le refus strict quand le corpus ne couvre pas la question', () => {
    const prompt = getActivePrompt('student');
    const rag = retrieveLocalRagChunks('Explique la physiologie du sommeil paradoxal chez le poulpe.');
    const system = `${prompt.template}${buildRagSystemSection(rag)}`;

    expect(rag.chunks).toHaveLength(0);
    expect(system).toContain(RAG_REFUSAL_MESSAGE);
    expect(system).toContain('RAG CITE-OR-REFUSE');
  });
});
