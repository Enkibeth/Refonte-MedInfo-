/**
 * Embeddings RAG — text-embedding-3-small (OpenAI), 1536 dimensions (ADR-0014).
 *
 * Le modèle tient exactement dans `rag_chunks.embedding vector(1536)` :
 * aucun ALTER de schéma. La fusion lexical+dense (RRF k=60) est déjà portée par
 * `match_rag_chunks` (migration 0009 / ledger 0007) ; il suffit de peupler les
 * vecteurs et d'envoyer un vrai vecteur de requête.
 *
 * Invariant CC-03 — ZÉRO pseudo-embedding :
 *  - à l'ingestion : clé OpenAI absente → on `throw` (jamais d'écriture de vecteur factice) ;
 *  - à la requête : l'appelant (`retrieval.ts`) intercepte l'échec et dégrade en
 *    lexical-only (`query_embedding = null`). On ne fabrique jamais un vecteur.
 *
 * EU residency + Zero Data Retention + DPA/SCC (01_REGULATION §5) sont une exigence
 * de configuration côté projet OpenAI (hors code), documentée dans l'ADR-0014.
 */
import { openai } from '@ai-sdk/openai';
import { embed as aiEmbed, embedMany as aiEmbedMany } from 'ai';

/** Modèle d'embedding retenu (ADR-0014). Source de vérité pour le code applicatif. */
export const EMBEDDING_MODEL = 'text-embedding-3-small';

/** Dimension du vecteur — doit rester == `rag_chunks.embedding vector(1536)`. */
export const EMBEDDING_DIMENSIONS = 1536;

function embeddingModel() {
  return openai.textEmbeddingModel(EMBEDDING_MODEL);
}

/**
 * Vrai si une clé OpenAI est présente. Ne valide pas la clé côté réseau :
 * sert uniquement à décider entre « tenter un embedding » et « dégrader proprement ».
 */
export function isEmbeddingConfigured(): boolean {
  const key = process.env.OPENAI_API_KEY;
  return typeof key === 'string' && key.trim().length > 0;
}

function assertConfigured(): void {
  if (!isEmbeddingConfigured()) {
    throw new Error(
      'OPENAI_API_KEY manquante : embeddings réels indisponibles. ' +
        'Aucun pseudo-embedding ne sera généré (CC-03).',
    );
  }
}

/** Garde anti-dérive : un vecteur d'une autre dimension trahit un mauvais modèle. */
function assertDimensions(vector: number[]): number[] {
  if (!Array.isArray(vector) || vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding de dimension inattendue (${Array.isArray(vector) ? vector.length : 'n/a'} ≠ ` +
        `${EMBEDDING_DIMENSIONS}) — modèle attendu : ${EMBEDDING_MODEL}.`,
    );
  }
  return vector;
}

/**
 * Embed un texte unique (ex. la requête utilisateur).
 * @throws si la clé OpenAI est absente — l'appelant doit dégrader, jamais inventer.
 */
export async function embedText(text: string): Promise<number[]> {
  assertConfigured();
  const { embedding } = await aiEmbed({ model: embeddingModel(), value: text });
  return assertDimensions(embedding);
}

/**
 * Embed un lot de textes (ingestion du corpus).
 * @throws si la clé OpenAI est absente.
 */
export async function embedMany(texts: string[]): Promise<number[][]> {
  assertConfigured();
  if (texts.length === 0) return [];
  const { embeddings } = await aiEmbedMany({ model: embeddingModel(), values: texts });
  return embeddings.map(assertDimensions);
}
