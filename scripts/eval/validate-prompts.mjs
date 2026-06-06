import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'src/ai/prompts';
// Inspecte uniquement les ARTEFACTS de prompt versionnés sous contrat (ex: public.v2.ts),
// qui portent regulatory_scope/forbidden_outputs/mandatory_sections/eval_threshold (_schema.ts).
// Exclut les fichiers d'infrastructure (pas des artefacts) :
//   - _schema.ts  : définition du contrat
//   - index.ts    : ré-exports
//   - promptStore.ts : loader/agrégateur (fallback TS + override Supabase), pas un artefact versionné
const NON_ARTIFACT_FILES = new Set(['index.ts', 'promptStore.ts']);
const files = readdirSync(dir).filter(
  (file) => file.endsWith('.ts') && !file.startsWith('_') && !NON_ARTIFACT_FILES.has(file),
);

for (const file of files) {
  const content = readFileSync(join(dir, file), 'utf8');
  for (const required of ['regulatory_scope', 'forbidden_outputs', 'mandatory_sections', 'eval_threshold']) {
    if (!content.includes(required)) {
      console.error(`${file} is missing prompt contract field: ${required}`);
      process.exit(1);
    }
  }
}

console.log(files.length === 0 ? 'OK — no prompt artifacts yet' : `OK — ${files.length} prompt artifacts validated`);
