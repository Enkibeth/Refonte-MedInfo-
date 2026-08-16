/**
 * Chargement des variables d'environnement pour le serveur Node autonome (Hostinger).
 *
 * Les variables viennent soit de l'environnement du processus (panneau hPanel,
 * `pm2 ecosystem`, systemd), soit d'un fichier `.env` déposé à côté de l'application.
 *
 * RÈGLE : l'environnement du processus GAGNE toujours sur le fichier. Un `.env` oublié sur
 * le serveur ne peut donc jamais écraser une clé posée dans le panneau d'hébergement —
 * c'est le sens de lecture le moins surprenant et le moins dangereux (une vieille clé API
 * traînant dans un fichier ne reprend pas la main silencieusement).
 *
 * ⚠️  Les variables `EXPO_PUBLIC_*` sont figées DANS LE BUNDLE à la compilation
 * (`expo export`). Les poser ici ne change rien au client déjà construit : elles doivent
 * être présentes au moment du build. Voir docs/09_DEPLOYMENT.md.
 */
import fs from 'node:fs';
import path from 'node:path';

/** Fichiers lus, du plus prioritaire au moins prioritaire. */
export const ENV_FILES = ['.env.production.local', '.env.local', '.env.production', '.env'];

/**
 * Parse un contenu de fichier `.env` (sous-ensemble volontairement strict et prévisible).
 *
 * Gère : commentaires `#`, lignes vides, `export KEY=value`, guillemets simples/doubles,
 * échappements `\n`/`\t`/`\\` dans les guillemets DOUBLES uniquement (comme dotenv),
 * valeurs non quotées trimmées avec commentaire de fin de ligne retiré.
 *
 * @param {string} text
 * @returns {Record<string, string>}
 */
export function parseDotEnv(text) {
  /** @type {Record<string, string>} */
  const out = {};
  if (typeof text !== 'string' || text.length === 0) return out;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;

    const withoutExport = line.startsWith('export ') ? line.slice('export '.length).trim() : line;
    const eq = withoutExport.indexOf('=');
    if (eq <= 0) continue;

    const key = withoutExport.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    let value = withoutExport.slice(eq + 1).trim();

    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
      value = value
        .slice(1, -1)
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
    } else if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
      value = value.slice(1, -1);
    } else {
      // Valeur non quotée : un `#` précédé d'un espace ouvre un commentaire de fin de ligne.
      const hash = value.search(/\s#/);
      if (hash >= 0) value = value.slice(0, hash);
      value = value.trim();
    }

    out[key] = value;
  }

  return out;
}

/**
 * Applique des variables SANS écraser celles déjà présentes dans l'environnement.
 *
 * @param {Record<string, string>} vars
 * @param {Record<string, string | undefined>} [env]
 * @returns {string[]} clés réellement appliquées (utile pour tracer sans révéler de valeur)
 */
export function applyEnv(vars, env = process.env) {
  /** @type {string[]} */
  const applied = [];
  for (const [key, value] of Object.entries(vars ?? {})) {
    if (env[key] !== undefined && env[key] !== '') continue;
    env[key] = value;
    applied.push(key);
  }
  return applied;
}

/**
 * Charge les fichiers `.env` présents dans `dir` (ordre de priorité `ENV_FILES`).
 *
 * @param {string} dir
 * @param {Record<string, string | undefined>} [env]
 * @returns {{ files: string[]; keys: string[] }}
 */
export function loadEnvFiles(dir, env = process.env) {
  /** @type {string[]} */
  const files = [];
  /** @type {string[]} */
  const keys = [];

  for (const name of ENV_FILES) {
    const file = path.join(dir, name);
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue; // Fichier absent (cas nominal en hébergement avec variables du panneau).
    }
    files.push(name);
    keys.push(...applyEnv(parseDotEnv(text), env));
  }

  return { files, keys };
}
