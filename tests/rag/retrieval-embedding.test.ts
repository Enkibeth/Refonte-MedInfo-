import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// CC-03 : retrieval doit envoyer un VRAI vecteur de requête (1536) à match_rag_chunks
// pour activer la fusion dense, et dégrader proprement en lexical-only (null) si
// l'embedding échoue — sans jamais fabriquer de vecteur. Aucun réseau ici (mocks).
vi.mock('@/rag/embeddings', () => ({
  isEmbeddingConfigured: vi.fn(() => true),
  embedText: vi.fn(),
}));
vi.mock('@/db/serverSupabase', () => ({
  createServerSupabaseClient: vi.fn(),
}));

import { retrieveRagContext } from '@/rag/retrieval';
import { embedText, isEmbeddingConfigured } from '@/rag/embeddings';
import { createServerSupabaseClient } from '@/db/serverSupabase';

const EMBEDDING_DIMENSIONS = 1536;
const queryVector = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.02);

const fakeRow = {
  chunk_id: 'has-dt2-parcours-2025-prevention-001',
  parent_doc_id: 'has-dt2-parcours-2025',
  title: 'Parcours de soins du diabète de type 2',
  emitter: 'HAS',
  section_path: 'Mesure de prévention en cas de prédiabète',
  source_url: 'https://www.has-sante.fr/jcms/p_3634754/fr/x',
  publication_date: '2025-07-16',
  has_grade: 'NA',
  edn_item_id: '245',
  edn_rang: 'A',
  specialty: 'Endocrinologie-diabétologie',
  license: 'HAS réutilisation publique avec attribution',
  validation_hash: 'sha256:deadbeef',
  content: 'Contenu HAS sur la prévention du diabète de type 2 (extrait sourcé).',
};

// Capture le dernier appel RPC dans des variables simples (évite l'indexation de tuples
// sous TS strict / noUncheckedIndexedAccess).
let lastRpcName: string | undefined;
let lastRpcParams: Record<string, unknown> | undefined;

function mockSupabaseRpc() {
  const rpc = vi.fn(async (name: string, params: Record<string, unknown>) => {
    lastRpcName = name;
    lastRpcParams = params;
    return { data: [fakeRow], error: null };
  });
  vi.mocked(createServerSupabaseClient).mockReturnValue({ rpc } as never);
  return rpc;
}

describe('retrieveRagContext — vecteur de requête & dégradation (CC-03)', () => {
  beforeEach(() => {
    lastRpcName = undefined;
    lastRpcParams = undefined;
    vi.mocked(isEmbeddingConfigured).mockReturnValue(true);
    vi.mocked(embedText).mockResolvedValue(queryVector);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('transmet un vecteur de requête de longueur 1536 à match_rag_chunks', async () => {
    const rpc = mockSupabaseRpc();
    const result = await retrieveRagContext('Que recommande la HAS sur le diabète de type 2 ?');

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(lastRpcName).toBe('match_rag_chunks');
    expect(Array.isArray(lastRpcParams?.query_embedding)).toBe(true);
    expect(lastRpcParams?.query_embedding).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(result.chunks[0]?.chunk_id).toBe(fakeRow.chunk_id);
  });

  it('dégrade en lexical-only (query_embedding null) si embedText échoue — jamais de vecteur factice', async () => {
    vi.mocked(embedText).mockRejectedValueOnce(new Error('réseau OpenAI indisponible'));
    mockSupabaseRpc();

    const result = await retrieveRagContext('Question avec embedding en échec');

    expect(lastRpcParams?.query_embedding).toBeNull();
    expect(result.chunks[0]?.chunk_id).toBe(fakeRow.chunk_id);
  });

  it('dégrade en lexical-only si aucune clé OpenAI (embedText jamais appelé)', async () => {
    vi.mocked(isEmbeddingConfigured).mockReturnValue(false);
    mockSupabaseRpc();

    await retrieveRagContext('Question sans clé OpenAI');

    expect(embedText).not.toHaveBeenCalled();
    expect(lastRpcParams?.query_embedding).toBeNull();
  });
});
