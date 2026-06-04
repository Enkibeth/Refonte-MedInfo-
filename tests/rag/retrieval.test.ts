import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildRagSystemSection,
  isLocalRagFallbackAllowed,
  retrieveLocalRagChunks,
  retrieveRagContext,
  RAG_REFUSAL_MESSAGE,
} from '@/rag/retrieval';

/**
 * Étape 5 : cite-or-refuse. Une question couverte par le petit corpus retourne une vraie
 * source HAS en dev/test ; une question hors corpus ne part pas en réponse encyclopédique
 * non sourcée. En production, le fallback local ne masque pas une Supabase vide/non configurée.
 */
describe('RAG retrieval MVP HAS/ANSM', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('retrouve une source HAS réelle pour une question générale sur le diabète de type 2', () => {
    const result = retrieveLocalRagChunks('Que dit la HAS sur le diabète de type 2 et le mode de vie ?');

    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.citations[0]).toMatchObject({
      emitter: 'HAS',
      url: 'https://www.has-sante.fr/jcms/p_3634754/fr/parcours-de-soins-du-patient-adulte-vivant-avec-un-diabete-de-type-2',
    });
  });

  it('produit un contexte cite-or-refuse quand aucune source officielle locale ne couvre la question', () => {
    const result = retrieveLocalRagChunks('Explique la physiologie du sommeil paradoxal chez le poulpe.');
    const systemSection = buildRagSystemSection(result);

    expect(result.chunks).toHaveLength(0);
    expect(systemSection).toContain(RAG_REFUSAL_MESSAGE);
  });

  it('désactive le fallback local par défaut en production pour ne pas masquer Supabase', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('RAG_ENABLE_LOCAL_FALLBACK', '');
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');

    const result = await retrieveRagContext('Que dit la HAS sur le diabète de type 2 ?');

    expect(isLocalRagFallbackAllowed()).toBe(false);
    expect(result.chunks).toHaveLength(0);
    expect(buildRagSystemSection(result)).toContain(RAG_REFUSAL_MESSAGE);
  });

  it('autorise explicitement le fallback local en production si RAG_ENABLE_LOCAL_FALLBACK=true', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('RAG_ENABLE_LOCAL_FALLBACK', 'true');
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');

    const result = await retrieveRagContext('Que dit la HAS sur le diabète de type 2 ?');

    expect(isLocalRagFallbackAllowed()).toBe(true);
    expect(result.chunks.length).toBeGreaterThan(0);
  });
});
