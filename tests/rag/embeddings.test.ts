import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// On mocke `ai` pour ne jamais toucher le réseau OpenAI dans les tests (CI-safe).
vi.mock('ai', () => ({
  embed: vi.fn(),
  embedMany: vi.fn(),
}));

import { embed as aiEmbed, embedMany as aiEmbedMany } from 'ai';
import {
  EMBEDDING_DIMENSIONS,
  embedMany,
  embedText,
  isEmbeddingConfigured,
} from '@/rag/embeddings';

const vec = (n = EMBEDDING_DIMENSIONS) => Array.from({ length: n }, () => 0.01);

describe('RAG embeddings — text-embedding-3-small (CC-03)', () => {
  beforeEach(() => {
    vi.mocked(aiEmbed).mockReset();
    vi.mocked(aiEmbedMany).mockReset();
    vi.stubEnv('OPENAI_API_KEY', 'sk-test-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('isEmbeddingConfigured reflète la présence de la clé', () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    expect(isEmbeddingConfigured()).toBe(false);
    vi.stubEnv('OPENAI_API_KEY', 'sk-xyz');
    expect(isEmbeddingConfigured()).toBe(true);
  });

  it('GARDE anti-pseudo-embedding : sans clé, embedText throw AVANT tout appel réseau', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    await expect(embedText('diabète de type 2')).rejects.toThrow(/OPENAI_API_KEY manquante/);
    expect(aiEmbed).not.toHaveBeenCalled();
  });

  it('embedText renvoie le vecteur 1536 dims du modèle', async () => {
    vi.mocked(aiEmbed).mockResolvedValue({ embedding: vec() } as never);
    const out = await embedText('AINS bon usage');
    expect(out).toHaveLength(EMBEDDING_DIMENSIONS);
  });

  it('embedText rejette un vecteur de dimension inattendue (garde anti-dérive)', async () => {
    vi.mocked(aiEmbed).mockResolvedValue({ embedding: vec(512) } as never);
    await expect(embedText('obésité adulte')).rejects.toThrow(/dimension inattendue/);
  });

  it('embedMany valide chaque vecteur et court-circuite sur entrée vide', async () => {
    expect(await embedMany([])).toEqual([]);
    expect(aiEmbedMany).not.toHaveBeenCalled();

    vi.mocked(aiEmbedMany).mockResolvedValue({ embeddings: [vec(), vec()] } as never);
    const out = await embedMany(['a', 'b']);
    expect(out).toHaveLength(2);
    expect(out[0]).toHaveLength(EMBEDDING_DIMENSIONS);
  });

  it('embedMany sans clé throw (ingestion : jamais de vecteur factice)', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    await expect(embedMany(['x'])).rejects.toThrow(/OPENAI_API_KEY manquante/);
    expect(aiEmbedMany).not.toHaveBeenCalled();
  });
});
