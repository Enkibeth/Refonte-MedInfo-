import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const corpusPath = resolve('src/rag/corpus/has-ansm-mvp.json');
const allowedEmitters = new Set(['HAS', 'ANSM', 'SPF', 'INCa', 'Orphanet', 'ameli.fr', 'CRAT', 'BDPM']);
const required = [
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

function fail(message) {
  console.error(`RAG metadata validation failed: ${message}`);
  process.exitCode = 1;
}

const raw = await readFile(corpusPath, 'utf8');
const chunks = JSON.parse(raw);

if (!Array.isArray(chunks) || chunks.length === 0) {
  fail('corpus must be a non-empty array');
} else {
  const seen = new Set();
  for (const [index, chunk] of chunks.entries()) {
    for (const key of required) {
      if (chunk[key] === undefined || chunk[key] === null || chunk[key] === '') {
        fail(`chunk[${index}] missing required field ${key}`);
      }
    }

    if (seen.has(chunk.chunk_id)) fail(`duplicate chunk_id ${chunk.chunk_id}`);
    seen.add(chunk.chunk_id);

    if (!allowedEmitters.has(chunk.emitter)) fail(`${chunk.chunk_id} has unauthorized emitter ${chunk.emitter}`);
    if (!String(chunk.source_url).startsWith('https://')) fail(`${chunk.chunk_id} source_url must be HTTPS`);
    if (!String(chunk.license).includes('réutilisation publique')) fail(`${chunk.chunk_id} license must declare public reuse with attribution`);
    const expectedHash = `sha256:${createHash('sha256').update(String(chunk.content), 'utf8').digest('hex')}`;
    if (chunk.validation_hash !== expectedHash) fail(`${chunk.chunk_id} validation_hash does not match content sha256`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(chunk.publication_date))) fail(`${chunk.chunk_id} publication_date must be YYYY-MM-DD`);
    if (String(chunk.content).length < 80) fail(`${chunk.chunk_id} content is too short to be useful`);
  }
}

if (process.exitCode) process.exit();
console.log(`OK — ${chunks.length} RAG chunks validated with required source/license/hash metadata`);
