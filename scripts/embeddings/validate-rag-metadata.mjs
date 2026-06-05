import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const corpusDir = resolve('src/rag/corpus');
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

// Le gate couvre TOUS les fichiers corpus *.json (pas seulement le MVP) : un nouveau
// fichier de corpus ne peut pas échapper à la validation source/license/hash (CC-03).
const files = (await readdir(corpusDir)).filter((name) => name.endsWith('.json')).sort();
const chunks = [];
for (const file of files) {
  const parsed = JSON.parse(await readFile(resolve(corpusDir, file), 'utf8'));
  if (!Array.isArray(parsed)) {
    fail(`${file} must be a JSON array`);
    continue;
  }
  for (const chunk of parsed) chunks.push(chunk);
}

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
console.log(`OK — ${chunks.length} RAG chunks (${files.length} corpus file(s)) validated with required source/license/hash metadata`);
