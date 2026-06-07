import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'src/ai/prompts';
// Inspecte uniquement les artefacts de prompt (ex: public.v2.ts). Exclut les
// fichiers d'infrastructure : `_schema.ts`, `index.ts` et `promptStore.ts`
// (registre de chargement des prompts, pas un artefact soumis au contrat).
const INFRA_FILES = new Set(['index.ts', 'promptStore.ts']);
const files = readdirSync(dir).filter(
  (file) => file.endsWith('.ts') && !file.startsWith('_') && !INFRA_FILES.has(file),
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
