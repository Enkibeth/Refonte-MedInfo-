import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'src/ai/prompts';
const files = readdirSync(dir).filter((file) => file.endsWith('.ts') && !file.startsWith('_'));

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
