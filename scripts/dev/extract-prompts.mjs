/**
 * Extraction one-shot des 3 prompts (étudiant / grand public / professionnel)
 * depuis le document fourni par Hugo, vers des modules TS verbatim.
 * Usage : node scripts/dev/extract-prompts.mjs <chemin-du-md>
 */
import fs from 'node:fs';

const src = process.argv[2];
if (!src) {
  console.error('Usage: node scripts/dev/extract-prompts.mjs <fichier.md>');
  process.exit(1);
}

let raw = fs.readFileSync(src, 'utf8');
// Normalise les séparateurs Unicode (U+2028/U+2029) et décode les entités HTML de l'export.
raw = raw
  .replace(/[\u2028\u2029]/g, '\n')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&');

const text = raw
  .split('\n')
  .map((l) => l.replace(/[ \t]+$/, ''))
  .join('\n');

const iPubHeader = text.indexOf('GRAND PUBLIC /');
const PUB_TITLE = 'PROMPT GRAND PUBLIC MEDINFO AI — VERSION COMPLÈTE';
const iPubStart = text.indexOf(PUB_TITLE);
const PRO_LABEL = 'Professionnel de santé :';
const iProLabel = text.indexOf(PRO_LABEL);
if (iPubHeader < 0 || iPubStart < 0 || iProLabel < 0) {
  console.error('markers not found', iPubHeader, iPubStart, iProLabel);
  process.exit(1);
}

let student = text.slice(0, iPubHeader);
student = student.replace(/^# 3 prompts\s+étudiants\s*:\s*/m, '');
// Le document se termine par une puce cassée (". Pas trop de smiley…") : on la répare sans rien retirer.
student = student.replace(/\.\s*Pas trop de smiley dans la réponse !\s*$/s, '• Pas trop de smiley dans la réponse !');
student = student.trim();

const pub = text.slice(iPubStart + PUB_TITLE.length, iProLabel).trim();
const pro = text.slice(iProLabel + PRO_LABEL.length).trim();

const esc = (s) => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

const file = (varName, personaLabel, body) => `/**
 * Prompt système — ${personaLabel} (refonte 2026-06, fourni par Hugo).
 * ⚠️ NE PAS RACCOURCIR NI REFORMULER : ce texte est la source de vérité produit.
 * Le contexte utilisateur (prénom/âge/sexe) est ajouté séparément par la route chat.
 */
export const ${varName} = \`${esc(body)}\`;
`;

fs.writeFileSync('src/ai/prompts/student.v3.ts', file('STUDENT_PROMPT_V3', 'Étudiant en santé', student));
fs.writeFileSync('src/ai/prompts/public.v3.ts', file('PUBLIC_PROMPT_V3', 'Grand public', pub));
fs.writeFileSync('src/ai/prompts/professional.v2.ts', file('PROFESSIONAL_PROMPT_V2', 'Professionnel de santé', pro));

console.log('lens', student.length, pub.length, pro.length);
console.log('S head:', JSON.stringify(student.slice(0, 80)));
console.log('S tail:', JSON.stringify(student.slice(-120)));
console.log('P head:', JSON.stringify(pub.slice(0, 80)));
console.log('P tail:', JSON.stringify(pub.slice(-120)));
console.log('PRO head:', JSON.stringify(pro.slice(0, 80)));
console.log('PRO tail:', JSON.stringify(pro.slice(-120)));
