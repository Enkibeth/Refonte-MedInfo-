/**
 * CC-03 — Mesure du recall@k du retrieval RAG sur la DB live.
 *
 * Interroge `match_rag_chunks` pour chaque question de
 * `tests/rag/recall-questions.fr.json` et calcule recall@1 / recall@3 (niveau chunk
 * et niveau document), plus le coût d'embedding réel en mode dense.
 *
 *   node scripts/eval/rag-recall.mjs                # lexical-only (query_embedding = null)
 *   node scripts/eval/rag-recall.mjs --mode=fused   # lexical + dense (RRF) — embed les requêtes
 *   node scripts/eval/rag-recall.mjs --k=3
 *
 * Hors chaîne CI : nécessite l'accès réseau à Supabase (et à OpenAI en mode fused).
 * Env : SUPABASE_URL (ou EXPO_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY,
 * et OPENAI_API_KEY pour --mode=fused. Aucun pseudo-embedding (CC-03).
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const USD_PER_1M_TOKENS = 0.02;

const args = process.argv.slice(2);
const MODE = (args.find((a) => a.startsWith('--mode='))?.split('=')[1] ?? 'lexical').toLowerCase();
const K = Number(args.find((a) => a.startsWith('--k='))?.split('=')[1] ?? 3);

function die(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

if (!['lexical', 'fused'].includes(MODE)) die(`--mode doit être lexical|fused (reçu : ${MODE}).`);

const dataset = JSON.parse(await readFile(resolve('tests/rag/recall-questions.fr.json'), 'utf8'));
const questions = dataset.questions ?? [];
const inCorpus = questions.filter((q) => !q.out_of_corpus);
const outOfCorpus = questions.filter((q) => q.out_of_corpus);

const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) die('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis.');

const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

let embedQuery = async () => null; // lexical : pas de vecteur.
let tokensUsed = 0;
if (MODE === 'fused') {
  if (!process.env.OPENAI_API_KEY?.trim()) die('OPENAI_API_KEY requise en mode fused (aucun pseudo-embedding).');
  const { openai } = await import('@ai-sdk/openai');
  const { embed } = await import('ai');
  embedQuery = async (text) => {
    const { embedding, usage } = await embed({ model: openai.textEmbeddingModel(EMBEDDING_MODEL), value: text });
    tokensUsed += usage?.tokens ?? 0;
    return `[${embedding.join(',')}]`;
  };
}

async function topChunks(question) {
  const query_embedding = await embedQuery(question);
  const { data, error } = await supabase.rpc('match_rag_chunks', {
    query_text: question,
    query_embedding,
    match_count: Math.max(K, 3),
  });
  if (error) die(`match_rag_chunks : ${error.message}`);
  return Array.isArray(data) ? data : [];
}

const hitAt = (rows, n, ids, key) => rows.slice(0, n).some((r) => ids.includes(r[key]));

let chunk1 = 0;
let chunk3 = 0;
let doc1 = 0;
let doc3 = 0;
console.log(`\nMode : ${MODE} | k : ${K} | questions in-corpus : ${inCorpus.length}\n`);
for (const q of inCorpus) {
  const rows = await topChunks(q.question);
  const c1 = hitAt(rows, 1, q.expected_chunk_ids, 'chunk_id');
  const c3 = hitAt(rows, 3, q.expected_chunk_ids, 'chunk_id');
  const d1 = hitAt(rows, 1, [q.expected_doc_id], 'parent_doc_id');
  const d3 = hitAt(rows, 3, [q.expected_doc_id], 'parent_doc_id');
  chunk1 += c1 ? 1 : 0;
  chunk3 += c3 ? 1 : 0;
  doc1 += d1 ? 1 : 0;
  doc3 += d3 ? 1 : 0;
  console.log(`  [${c1 ? '1' : c3 ? '3' : '✗'}] ${q.id} → top: ${rows.slice(0, 3).map((r) => r.chunk_id).join(', ') || '∅'}`);
}

const pct = (n) => `${((n / inCorpus.length) * 100).toFixed(1)}%`;
console.log(`\nRecall chunk  @1 = ${pct(chunk1)}  @3 = ${pct(chunk3)}`);
console.log(`Recall doc    @1 = ${pct(doc1)}  @3 = ${pct(doc3)}`);

if (outOfCorpus.length > 0) {
  let refused = 0;
  for (const q of outOfCorpus) {
    const rows = await topChunks(q.question);
    if (rows.length === 0) refused += 1;
    console.log(`  [cite-or-refuse] ${q.id} → ${rows.length === 0 ? 'aucune source (refus)' : `${rows.length} chunk(s) renvoyés`}`);
  }
  console.log(`Hors corpus : ${refused}/${outOfCorpus.length} sans source (cite-or-refuse).`);
}

if (MODE === 'fused') {
  console.log(`\nCoût embeddings requêtes : ${tokensUsed} tokens ≈ ${((tokensUsed / 1e6) * USD_PER_1M_TOKENS).toFixed(6)} USD (${EMBEDDING_MODEL}).`);
}
