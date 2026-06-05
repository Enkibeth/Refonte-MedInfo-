// Chargement du message de refus canonique — SOURCE UNIQUE.
// On NE réécrit JAMAIS ce message : on le lit verbatim depuis docs/01_REGULATION.md §4
// (blockquote unique). Ceci garantit l'alignement avec src/compliance/disclosures.ts
// (CANONICAL_REFUSAL) sans dépendre d'une transpilation TS.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const regulationPath = join(repoRoot, 'docs/01_REGULATION.md');

let cached = null;

/**
 * Renvoie le message de refus canonique verbatim depuis docs/01_REGULATION.md §4.
 * Recherche la phrase d'ancrage et extrait la ligne de blockquote correspondante.
 * @returns {string}
 */
export function getCanonicalRefusal() {
  if (cached) return cached;
  const text = readFileSync(regulationPath, 'utf8');
  const anchor = "MedInfo AI fournit de l'information médicale générale";
  const lines = text.split(/\r?\n/);
  const line = lines.find((l) => l.includes(anchor));
  if (!line) {
    throw new Error(`Message de refus canonique introuvable dans ${regulationPath}`);
  }
  // Retire le marqueur de citation Markdown « > » et l'italique « *…* ».
  let message = line.replace(/^\s*>\s?/, '').trim();
  if (message.startsWith('*') && message.endsWith('*')) {
    message = message.slice(1, -1).trim();
  }
  cached = message;
  return message;
}
