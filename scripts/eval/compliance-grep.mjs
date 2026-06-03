import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const roots = ['app', 'src/ui'];
const forbidden = [
  /diagnostic individuel/i,
  /diagnose your/i,
  /notre IA détecte votre/i,
  /votre diagnostic est/i,
  /nous diagnostiquons/i,
];
const allow = [/PlaceholderScreen\.tsx$/, /disclosures\.ts$/];

function walk(dir) {
  try {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      const stat = statSync(path);
      return stat.isDirectory() ? walk(path) : [path];
    });
  } catch {
    return [];
  }
}

const hits = [];
for (const file of roots.flatMap(walk)) {
  if (!/\.(ts|tsx|js|jsx)$/.test(file)) continue;
  if (allow.some((pattern) => pattern.test(file))) continue;
  const content = readFileSync(file, 'utf8');
  for (const pattern of forbidden) {
    if (pattern.test(content)) hits.push(`${file}: ${pattern}`);
  }
}

if (hits.length > 0) {
  console.error('Compliance grep failed:');
  console.error(hits.join('\n'));
  process.exit(1);
}

console.log('OK — compliance-grep');
