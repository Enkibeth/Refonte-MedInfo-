#!/usr/bin/env node
// benchmark-preflight.mjs — Valide le GEL DES VERSIONS de modèles avant un run (Phase 3).
//
// Lit benchmarks/models.lock.json (gabarit : models.lock.example.json). Vérifie :
//   - présence du fichier et structure ({ models: [...] }) ;
//   - en mode --live : chaque modèle activé a un model_id_exact NON vide et NON « stub »,
//     une date_figee renseignée, et la clé d'API de sa famille est présente dans l'environnement.
//   - en mode offline (défaut) : valide la structure et AVERTIT que les chemins seront en stub.
//
// process.exitCode = 1 si un run --live est demandé alors que les versions ne sont pas figées
// (identifiant vide / « stub ») ou qu'une clé manque. Refuse de laisser partir un run live non figé.
//
// Le harness est un OUTIL : aucune logique médicale. medinfo reste un STUB tant que le produit
// n'existe pas — un run live de medinfo est explicitement refusé.
//
// Usage :
//   node scripts/eval/benchmark-preflight.mjs                 # offline : structure + avertit stub
//   node scripts/eval/benchmark-preflight.mjs --live           # exige des versions figées + clés
//   node scripts/eval/benchmark-preflight.mjs --lock benchmarks/models.lock.json --live

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { hasApiKey } from './lib/providers.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const benchmarksDir = join(repoRoot, 'benchmarks');

export function parseArgs(argv) {
  const args = { live: false, lock: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--live') args.live = true;
    else if (a === '--offline') args.live = false;
    else if (a === '--lock') args.lock = argv[++i];
    else if (a.startsWith('--')) throw new Error(`Argument inconnu : ${a}`);
  }
  return args;
}

/** Un identifiant figé valide : non vide, non placeholder, non « stub ». */
function isFrozenId(id) {
  if (typeof id !== 'string') return false;
  const s = id.trim();
  if (s === '' || s === '____' || s === 'TODO') return false;
  if (/stub/i.test(s)) return false;
  return true;
}

/**
 * Valide la structure et le gel d'un lock. PUR (pas d'I/O) pour faciliter les tests.
 * @param {Object} lock contenu parsé de models.lock.json
 * @param {{live:boolean, keyPresent:(family:string)=>boolean}} opts
 * @returns {{ok:boolean, errors:string[], warnings:string[], rows:Array}}
 */
export function validateLock(lock, opts) {
  const errors = [];
  const warnings = [];
  const rows = [];

  if (!lock || typeof lock !== 'object' || !Array.isArray(lock.models)) {
    return { ok: false, errors: ['Structure invalide : objet attendu avec un tableau `models`.'], warnings, rows };
  }
  if (lock.models.length === 0) {
    warnings.push('Aucun modèle déclaré dans `models`.');
  }

  for (const m of lock.models) {
    const name = m.name ?? m.provider ?? '(sans nom)';
    const enabled = m.enabled !== false; // activé par défaut
    const isMedinfo = String(m.provider ?? name).startsWith('medinfo') || /medinfo/i.test(name);
    const frozen = isFrozenId(m.model_id_exact);
    const dated = typeof m.date_figee === 'string' && m.date_figee.trim() !== '' && m.date_figee.trim() !== '____';

    let status = 'ok';
    if (!enabled) {
      status = 'désactivé';
    } else if (opts.live) {
      // Mode live : exigences strictes.
      if (isMedinfo) {
        errors.push(`${name} : medinfo est un STUB (produit non construit) — run --live refusé pour ce modèle.`);
        status = 'refusé (stub medinfo)';
      } else {
        if (!frozen) {
          errors.push(`${name} : model_id_exact non figé («${m.model_id_exact ?? ''}») — interdit en --live.`);
          status = 'non figé';
        }
        if (!dated) {
          errors.push(`${name} : date_figee manquante — interdit en --live.`);
          if (status === 'ok') status = 'non daté';
        }
        const family = m.provider ?? '';
        if (frozen && !opts.keyPresent(family)) {
          errors.push(`${name} : clé d'API manquante pour la famille « ${family} » (--live).`);
          if (status === 'ok') status = 'clé manquante';
        }
      }
    } else {
      // Mode offline : on signale simplement le futur stub.
      if (isMedinfo || !frozen) {
        warnings.push(`${name} : chemin en STUB en mode offline (model_id_exact=«${m.model_id_exact ?? ''}»).`);
        status = 'stub (offline)';
      }
    }
    rows.push({ name, provider: m.provider ?? '', mode: m.mode ?? '', id: m.model_id_exact ?? '', date: m.date_figee ?? '', status });
  }

  return { ok: errors.length === 0, errors, warnings, rows };
}

function printTable(headers, rows) {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i]).length)));
  const fmt = (cells) => `| ${cells.map((c, i) => String(c).padEnd(widths[i])).join(' | ')} |`;
  const sep = `| ${widths.map((w) => '-'.repeat(w)).join(' | ')} |`;
  console.log([fmt(headers), sep, ...rows.map((r) => fmt(r))].join('\n'));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const lockPath = args.lock ? resolve(args.lock) : join(benchmarksDir, 'models.lock.json');

  console.log(`[preflight] mode=${args.live ? 'LIVE' : 'offline'} lock=${lockPath}`);

  if (!existsSync(lockPath)) {
    if (args.live) {
      console.error(`✗ ${lockPath} introuvable — un run --live exige un lock de versions figées.`);
      console.error('  Copie benchmarks/models.lock.example.json → benchmarks/models.lock.json et fige les identifiants.');
      process.exitCode = 1;
      return;
    }
    console.warn(`[preflight] ${lockPath} absent (offline) — le run utilisera des STUBS déterministes.`);
    console.warn('[preflight] Avant un run réel : copier models.lock.example.json et figer les versions.');
    return;
  }

  let lock;
  try {
    lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  } catch (e) {
    console.error(`✗ ${lockPath} : JSON invalide (${e.message}).`);
    process.exitCode = 1;
    return;
  }

  const result = validateLock(lock, { live: args.live, keyPresent: hasApiKey });

  if (result.rows.length > 0) {
    printTable(['modèle', 'provider', 'mode', 'model_id_exact', 'date_figée', 'statut'],
      result.rows.map((r) => [r.name, r.provider, r.mode, r.id || '—', r.date || '—', r.status]));
  }
  for (const w of result.warnings) console.warn(`⚠ ${w}`);

  if (!args.live) {
    console.log('\n[preflight] OFFLINE : structure validée. Les chemins non figés seront en STUB (CI-safe).');
    if (!result.ok && result.errors.length > 0) {
      // En offline, les erreurs de gel ne bloquent pas (informatives) mais on les liste.
      for (const e of result.errors) console.warn(`note : ${e}`);
    }
    return;
  }

  if (!result.ok) {
    console.error('\n✗ PREFLIGHT LIVE ÉCHOUÉ — versions non figées ou clés manquantes :');
    for (const e of result.errors) console.error(`  - ${e}`);
    process.exitCode = 1;
    return;
  }
  console.log('\n✓ Preflight LIVE OK : toutes les versions actives sont figées et les clés présentes.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}
