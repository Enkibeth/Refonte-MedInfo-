#!/usr/bin/env node
// benchmark-pilot.mjs — Sélectionne un sous-ensemble PILOTE stratifié du golden set,
// puis (sauf --no-run) exécute le run dessus. But : un jeu RÉDUIT et reproductible
// pour calibrer juge↔humain et mesurer κ AVANT le run complet (docs/10_BENCHMARK.md §15 Phase 3).
//
// Le harness est un OUTIL d'évaluation : aucune logique médicale. Hors-ligne par défaut (stub).
//
// Réutilise la logique de benchmark-run.mjs (loadDataset / runItems / RESULT_COLUMNS) — on ne
// duplique PAS le moteur de run. L'échantillonnage est délégué à lib/sampling.mjs (déterministe).
//
// Usage :
//   node scripts/eval/benchmark-pilot.mjs --set safety --n 12 --offline
//   node scripts/eval/benchmark-pilot.mjs --set all --n 24 --seed 7 --no-run
//   node scripts/eval/benchmark-pilot.mjs --set safety --n 12 --models medinfo,openai
//
// Sortie : benchmarks/runs/<ts>/pilot/pilot.items.csv + pilot.meta.json
//          (+ results.raw.csv via le moteur de run, sauf --no-run).

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { toCsv } from './lib/csv.mjs';
import { stratifiedSample } from './lib/sampling.mjs';
import { loadDataset, runItems, RESULT_COLUMNS } from './benchmark-run.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const benchmarksDir = join(repoRoot, 'benchmarks');

// Strates par défaut selon le set : les items de questions portent `dimension`, les safety `gravite`.
// On combine les deux champs disponibles ; sampling tolère un champ absent (∅).
const DEFAULT_STRATA = ['dimension', 'gravite'];

export function parseArgs(argv) {
  const args = {
    set: 'all', n: 24, seed: 12345, strata: null,
    offline: true, live: false, models: null, runs: 1, temperature: 0, noRun: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--offline') { args.offline = true; args.live = false; }
    else if (a === '--live') { args.live = true; args.offline = false; }
    else if (a === '--set') args.set = argv[++i];
    else if (a === '--n') args.n = Number.parseInt(argv[++i], 10);
    else if (a === '--seed') args.seed = argv[++i];
    else if (a === '--strata') args.strata = argv[++i];
    else if (a === '--models') args.models = argv[++i];
    else if (a === '--runs') args.runs = Number.parseInt(argv[++i], 10);
    else if (a === '--temperature') args.temperature = Number.parseFloat(argv[++i]);
    else if (a === '--no-run') args.noRun = true;
    else if (a === '--out') args.out = argv[++i];
    else if (a.startsWith('--')) throw new Error(`Argument inconnu : ${a}`);
  }
  if (!Number.isInteger(args.n) || args.n < 1) throw new Error('--n doit être un entier ≥ 1');
  if (!Number.isInteger(args.runs) || args.runs < 1) throw new Error('--runs doit être un entier ≥ 1');
  return args;
}

function nowIso() {
  return new Date().toISOString();
}

/** Champ de stratification effectivement présent dans les items (filtre les colonnes absentes). */
function effectiveStrata(items, requested) {
  const present = new Set();
  for (const item of items) {
    for (const f of requested) {
      if (item[f] !== undefined && item[f] !== '' && item[f] !== null) present.add(f);
    }
  }
  return requested.filter((f) => present.has(f));
}

/** Sérialise les items pilote choisis vers un CSV lisible (un par ligne, traçable). */
function pilotItemsCsv(items) {
  const columns = ['id', 'kind', 'dimension', 'gravite', 'persona', 'action_attendue', 'question'];
  const rows = items.map((it) => ({
    id: it.id,
    kind: it.kind,
    dimension: it.dimension ?? '',
    gravite: it.gravite ?? '',
    persona: it.persona ?? '',
    action_attendue: it.action_attendue ?? '',
    question: it.question ?? '',
  }));
  return toCsv(rows, columns);
}

/** Compte les items par valeur d'un champ (pour vérifier les proportions de strate dans la meta). */
function distribution(items, field) {
  const dist = {};
  for (const it of items) {
    const key = it[field] ?? '∅';
    dist[key] = (dist[key] ?? 0) + 1;
  }
  return dist;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const live = args.live && !args.offline;
  const modelNames = (args.models ?? 'medinfo,openai,anthropic')
    .split(',').map((s) => s.trim()).filter(Boolean);

  const population = loadDataset(args.set);
  const requestedStrata = args.strata
    ? args.strata.split(',').map((s) => s.trim()).filter(Boolean)
    : DEFAULT_STRATA;
  const strata = effectiveStrata(population, requestedStrata);

  const sample = stratifiedSample(population, { n: args.n, strata, seed: args.seed });

  const startedAt = new Date();
  const timestamp = startedAt.toISOString().replace(/[:.]/g, '-');
  const runDir = args.out ? resolve(args.out) : join(benchmarksDir, 'runs', timestamp);
  const pilotDir = join(runDir, 'pilot');
  mkdirSync(pilotDir, { recursive: true });

  console.log(`[pilot] set=${args.set} population=${population.length} → échantillon=${sample.length} (n demandé=${args.n})`);
  console.log(`[pilot] strates=${strata.length ? strata.join(',') : '(aucune)'} seed=${args.seed}`);

  const itemsCsvPath = join(pilotDir, 'pilot.items.csv');
  writeFileSync(itemsCsvPath, pilotItemsCsv(sample), 'utf8');

  const meta = {
    kind: 'pilot',
    generated_at: nowIso(),
    set: args.set,
    n_requested: args.n,
    n_selected: sample.length,
    population_size: population.length,
    strata,
    seed: String(args.seed),
    live,
    models: modelNames,
    runs: args.runs,
    temperature: args.temperature,
    distributions: Object.fromEntries(strata.map((f) => [f, {
      population: distribution(population, f),
      sample: distribution(sample, f),
    }])),
    selected_ids: sample.map((it) => it.id),
    note: 'Sous-ensemble PILOTE pour calibration juge↔humain et κ avant le run complet. Sorties medinfo en STUB tant que le produit n\'est pas construit.',
  };
  writeFileSync(join(pilotDir, 'pilot.meta.json'), `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
  console.log(`[pilot] ${sample.length} items écrits → ${itemsCsvPath}`);
  console.log(`[pilot] meta → ${join(pilotDir, 'pilot.meta.json')}`);

  if (args.noRun) {
    console.log('[pilot] --no-run : sélection seule, pas d\'exécution du run.');
    return;
  }

  // Exécution du run sur l'échantillon pilote (réutilise le moteur de benchmark-run.mjs).
  const { rows, providers, runId } = await runItems({
    items: sample,
    modelNames,
    runs: args.runs,
    temperature: args.temperature,
    live,
    log: (msg) => console.log(`[pilot] ${msg}`),
  });

  const rawCsvPath = join(pilotDir, 'results.raw.csv');
  writeFileSync(rawCsvPath, toCsv(rows, RESULT_COLUMNS), 'utf8');

  const runMeta = {
    run_id: runId,
    pilot: true,
    finished_at: nowIso(),
    set: args.set,
    models: modelNames,
    runs: args.runs,
    temperature: args.temperature,
    live,
    item_count: sample.length,
    row_count: rows.length,
    providers: Object.fromEntries([...providers].map(([n, p]) => [n, { kind: p.kind, family: p.family }])),
  };
  writeFileSync(join(pilotDir, 'run.meta.json'), `${JSON.stringify(runMeta, null, 2)}\n`, 'utf8');
  console.log(`[pilot] ${rows.length} lignes de run écrites → ${rawCsvPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}

export { effectiveStrata };
