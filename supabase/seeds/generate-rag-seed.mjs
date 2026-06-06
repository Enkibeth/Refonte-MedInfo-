#!/usr/bin/env node
/**
 * Génère le seed SQL RAG de dev depuis src/rag/corpus/*.json.
 *
 * Reproductibilité : les fichiers JSON sont triés, les sources sont dédupliquées par
 * parent_doc_id et les hashes sha256(content) sont recalculés/contrôlés avant écriture.
 */
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const corpusDir = resolve('src/rag/corpus');
const outputPath = resolve('supabase/seeds/02_dev_rag_corpus.sql');

function sqlString(value) {
  if (value === null || value === undefined || value === '') return 'null';
  return `'${String(value).replaceAll("'", "''")}'`;
}

function row(values) {
  return `  (${values.map(sqlString).join(', ')})`;
}

const files = (await readdir(corpusDir)).filter((name) => name.endsWith('.json')).sort();
const chunks = [];
for (const file of files) {
  const parsed = JSON.parse(await readFile(resolve(corpusDir, file), 'utf8'));
  if (!Array.isArray(parsed)) throw new Error(`${file} must be a JSON array`);
  for (const chunk of parsed) {
    const expectedHash = `sha256:${createHash('sha256').update(String(chunk.content), 'utf8').digest('hex')}`;
    if (chunk.validation_hash !== expectedHash) {
      throw new Error(`${chunk.chunk_id} validation_hash mismatch: expected ${expectedHash}`);
    }
    chunks.push(chunk);
  }
}

if (chunks.length === 0) throw new Error('No RAG chunks found');

const sources = new Map();
for (const chunk of chunks) {
  const source = {
    id: chunk.parent_doc_id,
    title: chunk.title,
    emitter: chunk.emitter,
    source_url: chunk.source_url,
    publication_date: chunk.publication_date,
    license: chunk.license,
  };
  const previous = sources.get(source.id);
  if (previous && JSON.stringify(previous) !== JSON.stringify(source)) {
    throw new Error(`Conflicting metadata for source ${source.id}`);
  }
  sources.set(source.id, source);
}

const sourceRows = [...sources.values()]
  .sort((a, b) => a.id.localeCompare(b.id))
  .map((source) => row([source.id, source.title, source.emitter, source.source_url, source.publication_date, source.license]))
  .join(',\n');

const chunkRows = chunks
  .sort((a, b) => a.chunk_id.localeCompare(b.chunk_id))
  .map((chunk) =>
    row([
      chunk.chunk_id,
      chunk.parent_doc_id,
      chunk.section_path,
      chunk.content,
      chunk.has_grade,
      chunk.edn_item_id ?? null,
      chunk.edn_rang,
      chunk.specialty,
      chunk.license,
      chunk.validation_hash,
    ]),
  )
  .join(',\n');

const generatedAt = 'deterministic';
const sql = `-- Seed RAG dev généré par supabase/seeds/generate-rag-seed.mjs (${generatedAt}).\n-- Source de vérité : src/rag/corpus/*.json. Ne pas éditer à la main.\n-- Aucune donnée utilisateur ni donnée de santé identifiable.\n\ninsert into public.rag_sources (id, title, emitter, source_url, publication_date, license)\nvalues\n${sourceRows}\non conflict (id) do update set\n  title = excluded.title,\n  emitter = excluded.emitter,\n  source_url = excluded.source_url,\n  publication_date = excluded.publication_date,\n  license = excluded.license;\n\ninsert into public.rag_chunks (\n  chunk_id,\n  parent_doc_id,\n  section_path,\n  content,\n  has_grade,\n  edn_item_id,\n  edn_rang,\n  specialty,\n  license,\n  validation_hash\n)\nvalues\n${chunkRows}\non conflict (chunk_id) do update set\n  parent_doc_id = excluded.parent_doc_id,\n  section_path = excluded.section_path,\n  content = excluded.content,\n  has_grade = excluded.has_grade,\n  edn_item_id = excluded.edn_item_id,\n  edn_rang = excluded.edn_rang,\n  specialty = excluded.specialty,\n  license = excluded.license,\n  validation_hash = excluded.validation_hash;\n`;

await writeFile(outputPath, sql);
console.log(`Wrote ${outputPath} from ${files.length} corpus files (${sources.size} sources, ${chunks.length} chunks)`);
