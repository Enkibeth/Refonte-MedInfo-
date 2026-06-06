/**
 * CC-03 — Ingestion du corpus RAG avec embeddings réels.
 *
 * Lit `src/rag/corpus/*.json` → valide les métadonnées (mêmes règles que le gate
 * `rag-license`) → embed (text-embedding-3-small, 1536 dims) → upsert `rag_sources`
 * et `rag_chunks` AVEC `embedding` (clé service-role, contourne la RLS).
 *
 * Idempotent : on ne ré-embed un chunk que si son `validation_hash` a changé ou si
 * son `embedding` est absent (sauf `--force`). Hors chaîne CI (réseau OpenAI + DB).
 *
 * Invariant CC-03 — ZÉRO pseudo-embedding : pas de clé OpenAI → on s'arrête (throw),
 * jamais d'écriture de vecteur factice.
 *
 * Usage :
 *   node scripts/embeddings/ingest-corpus.mjs            # ingestion réelle
 *   node scripts/embeddings/ingest-corpus.mjs --dry-run  # valide + plan, sans réseau ni DB
 *   node scripts/embeddings/ingest-corpus.mjs --force    # ré-embed tout le corpus
 *
 * Prérequis env : OPENAI_API_KEY, SUPABASE_URL (ou EXPO_PUBLIC_SUPABASE_URL),
 * SUPABASE_SERVICE_ROLE_KEY. Rappel 01_REGULATION §5 : projet OpenAI en EU Data
 * Residency + Zero Data Retention + DPA/SCC avant toute ingestion de production.
 */
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

// Constantes alignées sur src/rag/embeddings.ts (source de vérité côté applicatif).
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
// Tarif text-embedding-3-small (USD / 1M tokens), à reconfirmer au run réel.
const USD_PER_1M_TOKENS = 0.02;

const CORPUS_DIR = resolve('src/rag/corpus');
const ALLOWED_EMITTERS = new Set(['HAS', 'ANSM', 'SPF', 'INCa', 'Orphanet', 'ameli.fr', 'CRAT', 'BDPM', 'EMA', 'ECDC', 'OMS']);
const REQUIRED_FIELDS = [
  'chunk_id',
  'parent_doc_id',
  'title',
  'emitter',
  'section_path',
  'source_url',
  'publication_date',
  'has_grade',
  'edn_rang',
  'specialty',
  'license',
  'validation_hash',
  'content',
];

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const FORCE = args.has('--force');

function die(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

/** Charge tous les fichiers corpus JSON et les concatène. */
async function loadCorpus() {
  const files = (await readdir(CORPUS_DIR)).filter((f) => f.endsWith('.json')).sort();
  if (files.length === 0) die(`aucun fichier corpus *.json dans ${CORPUS_DIR}`);
  const chunks = [];
  for (const file of files) {
    const raw = await readFile(resolve(CORPUS_DIR, file), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) die(`${file} doit être un tableau JSON`);
    for (const chunk of parsed) chunks.push({ ...chunk, __file: file });
  }
  return chunks;
}

/** Mêmes règles que scripts/embeddings/validate-rag-metadata.mjs (gate rag-license). */
function validate(chunks) {
  const seen = new Set();
  for (const [i, chunk] of chunks.entries()) {
    const ref = chunk.chunk_id ?? `index ${i}`;
    for (const key of REQUIRED_FIELDS) {
      if (chunk[key] === undefined || chunk[key] === null || chunk[key] === '') {
        die(`${ref} (${chunk.__file}) : champ requis manquant « ${key} »`);
      }
    }
    if (seen.has(chunk.chunk_id)) die(`chunk_id dupliqué : ${chunk.chunk_id}`);
    seen.add(chunk.chunk_id);
    if (!ALLOWED_EMITTERS.has(chunk.emitter)) die(`${ref} : émetteur non autorisé « ${chunk.emitter} »`);
    if (!String(chunk.source_url).startsWith('https://')) die(`${ref} : source_url doit être en HTTPS`);
    if (!String(chunk.license).includes('réutilisation publique')) {
      die(`${ref} : license doit déclarer la réutilisation publique avec attribution`);
    }
    const expected = `sha256:${createHash('sha256').update(String(chunk.content), 'utf8').digest('hex')}`;
    if (chunk.validation_hash !== expected) die(`${ref} : validation_hash ≠ sha256(content)`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(chunk.publication_date))) die(`${ref} : publication_date doit être YYYY-MM-DD`);
    if (String(chunk.content).length < 80) die(`${ref} : content trop court`);
  }
}

/** Sources dédupliquées par parent_doc_id, dérivées des chunks. */
function deriveSources(chunks) {
  const byId = new Map();
  for (const c of chunks) {
    if (byId.has(c.parent_doc_id)) continue;
    byId.set(c.parent_doc_id, {
      id: c.parent_doc_id,
      title: c.title,
      emitter: c.emitter,
      source_url: c.source_url,
      publication_date: c.publication_date,
      license: c.license,
    });
  }
  return [...byId.values()];
}

function chunkMetadataRow(c) {
  return {
    chunk_id: c.chunk_id,
    parent_doc_id: c.parent_doc_id,
    section_path: c.section_path,
    content: c.content,
    has_grade: c.has_grade,
    edn_item_id: c.edn_item_id ?? null,
    edn_rang: c.edn_rang,
    specialty: c.specialty,
    license: c.license,
    validation_hash: c.validation_hash,
  };
}

/** Format littéral pgvector : '[v1,v2,...]' (cast text→vector côté Postgres). */
function toVectorLiteral(vec) {
  return `[${vec.join(',')}]`;
}

async function main() {
  const chunks = await loadCorpus();
  validate(chunks);
  const sources = deriveSources(chunks);
  const estTokens = chunks.reduce((n, c) => n + Math.ceil(c.content.length / 4), 0);

  console.log(`Corpus : ${chunks.length} chunks, ${sources.length} sources (${CORPUS_DIR})`);
  console.log(`Modèle : ${EMBEDDING_MODEL} (${EMBEDDING_DIMENSIONS} dims)`);

  if (DRY_RUN) {
    console.log(`\n[--dry-run] aucune écriture, aucun appel réseau.`);
    console.log(`Estimation grossière : ~${estTokens} tokens (≈ ${(estTokens / 1e6) * USD_PER_1M_TOKENS} USD au tarif ${USD_PER_1M_TOKENS}/1M).`);
    console.log(`OK — corpus valide, prêt pour l'ingestion réelle.`);
    return;
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    die('OPENAI_API_KEY manquante — aucun pseudo-embedding ne sera généré (CC-03).');
  }
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) die('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis (clé service-role).');

  // Imports dynamiques : le mode --dry-run reste exécutable même sans ces modules réseau.
  const { createClient } = await import('@supabase/supabase-js');
  const { openai } = await import('@ai-sdk/openai');
  const { embedMany } = await import('ai');

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  // État existant pour l'idempotence : hash connu + présence d'embedding.
  const { data: existingRows, error: readErr } = await supabase
    .from('rag_chunks')
    .select('chunk_id, validation_hash, embedding');
  if (readErr) die(`lecture rag_chunks : ${readErr.message}`);
  const knownHash = new Map();
  const hasEmbedding = new Set();
  for (const row of existingRows ?? []) {
    knownHash.set(row.chunk_id, row.validation_hash);
    if (row.embedding != null) hasEmbedding.add(row.chunk_id);
  }

  const needsEmbedding = chunks.filter(
    (c) => FORCE || knownHash.get(c.chunk_id) !== c.validation_hash || !hasEmbedding.has(c.chunk_id),
  );

  // 1) Sources (upsert).
  {
    const { error } = await supabase.from('rag_sources').upsert(sources, { onConflict: 'id' });
    if (error) die(`upsert rag_sources : ${error.message}`);
    console.log(`✓ ${sources.length} sources upsertées`);
  }

  // 2) Métadonnées des chunks (upsert sans toucher la colonne embedding).
  {
    const { error } = await supabase
      .from('rag_chunks')
      .upsert(chunks.map(chunkMetadataRow), { onConflict: 'chunk_id' });
    if (error) die(`upsert rag_chunks (métadonnées) : ${error.message}`);
    console.log(`✓ ${chunks.length} chunks (métadonnées) upsertés`);
  }

  // 3) Embeddings réels (uniquement les chunks à (re)calculer).
  let tokens = 0;
  if (needsEmbedding.length === 0) {
    console.log('✓ embeddings déjà à jour — rien à (re)calculer (idempotent).');
  } else {
    const { embeddings, usage } = await embedMany({
      model: openai.textEmbeddingModel(EMBEDDING_MODEL),
      values: needsEmbedding.map((c) => c.content),
    });
    tokens = usage?.tokens ?? 0;
    for (const [i, c] of needsEmbedding.entries()) {
      const vec = embeddings[i];
      if (!Array.isArray(vec) || vec.length !== EMBEDDING_DIMENSIONS) {
        die(`${c.chunk_id} : embedding de dimension inattendue (${vec?.length} ≠ ${EMBEDDING_DIMENSIONS}).`);
      }
      const { error } = await supabase
        .from('rag_chunks')
        .update({ embedding: toVectorLiteral(vec) })
        .eq('chunk_id', c.chunk_id);
      if (error) die(`update embedding ${c.chunk_id} : ${error.message}`);
    }
    console.log(`✓ ${needsEmbedding.length} embeddings écrits (${tokens} tokens, ≈ ${(tokens / 1e6) * USD_PER_1M_TOKENS} USD).`);
  }

  // 4) Vérification de cohérence post-ingestion.
  const { count: total } = await supabase.from('rag_chunks').select('*', { count: 'exact', head: true });
  const { count: withEmb } = await supabase
    .from('rag_chunks')
    .select('*', { count: 'exact', head: true })
    .not('embedding', 'is', null);
  console.log(`\nÉtat DB : ${withEmb}/${total} chunks avec embedding.`);
  if (withEmb !== total) {
    die(`incohérence : ${total - withEmb} chunk(s) sans embedding après ingestion.`);
  }
  console.log('✓ Ingestion terminée — dense actif (chunks_with_embedding == total).');
}

main().catch((err) => die(err?.message ?? String(err)));
