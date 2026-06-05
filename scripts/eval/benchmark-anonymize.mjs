#!/usr/bin/env node
// benchmark-anonymize.mjs — Produit des PAQUETS D'ÉVALUATION AVEUGLE (double aveugle) à partir
// d'un results.raw.csv (ou results.judged.csv). Pour chaque évaluateur : un fichier CSV où
// l'IDENTITÉ DU MODÈLE N'APPARAÎT PAS, l'ordre est randomisé (seed DIFFÉRENT par évaluateur pour
// décorréler l'ordre), et les colonnes de scoring sont VIDES (à remplir à la main).
//
// docs/10_BENCHMARK.md §10 : « réponses dé-identifiées, métadonnées modèle stockées à part,
// ré-appariées après scoring ». La table de correspondance (CLÉ SCELLÉE) est écrite SOUS
// benchmarks/runs/<ts>/.keys/ (dossier gitignoré via benchmarks/runs/) — JAMAIS ailleurs.
//
// Usage :
//   node scripts/eval/benchmark-anonymize.mjs --in benchmarks/runs/<ts>/results.raw.csv
//   node scripts/eval/benchmark-anonymize.mjs --in <...> --evaluators A,B,C --seed 7

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseCsv, toCsv } from './lib/csv.mjs';
import { hashSeed, mulberry32 } from './lib/stats.mjs';
import { shuffle } from './lib/sampling.mjs';
import { loadDataset } from './benchmark-run.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// Les 10 critères de scoring_rubric.md (colonnes VIDES à remplir par l'évaluateur).
const RUBRIC_COLUMNS = [
  'exactitude_20', 'completude_10', 'pertinence_10', 'clarte_10', 'prudence_10',
  'safebox_10', 'sources_15', 'hallucination_10', 'incertitude_3', 'ux_2', 'total_100',
];

// Les 6 flags éliminatoires (scoring_rubric.md §Critères ÉLIMINATOIRES) — VIDES (à cocher 0/1).
const ELIMINATORY_FLAGS = [
  'flag_source_inventee', 'flag_diagnostic_individualise', 'flag_posologie_dangereuse',
  'flag_urgence_ratee', 'flag_reco_therapeutique_perso', 'flag_contredit_reco_officielle',
];

// Colonnes safe-box + commentaire (VIDES). safebox_action_attendue est laissée VISIBLE
// (elle ne révèle pas le modèle) pour guider la notation des items blocs D/E.
const SAFEBOX_COLUMNS = ['safebox_action_observee', 'safebox_classement', 'commentaire'];

// Colonnes contextuelles montrées à l'évaluateur (aucune ne révèle l'identité du modèle).
const CONTEXT_COLUMNS = ['blind_label', 'question_id', 'dimension', 'persona', 'safebox_action_attendue', 'question', 'response_text'];

const PACKET_COLUMNS = [...CONTEXT_COLUMNS, ...RUBRIC_COLUMNS, ...ELIMINATORY_FLAGS, ...SAFEBOX_COLUMNS];

export function parseArgs(argv) {
  const args = { in: null, evaluators: 'A,B', seed: 12345, out: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--in') args.in = argv[++i];
    else if (a === '--evaluators') args.evaluators = argv[++i];
    else if (a === '--seed') args.seed = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a.startsWith('--')) throw new Error(`Argument inconnu : ${a}`);
  }
  if (!args.in) throw new Error('--in <results.raw.csv | results.judged.csv> requis');
  return args;
}

/**
 * Extrait le texte de réponse du modèle depuis la colonne commentaire (JSON consigné au run),
 * puis ANONYMISE le préfixe de stub « [STUB <modèle>] » qui révélerait l'identité du modèle.
 * (En offline, le provider stub préfixe ses réponses ; on neutralise cette fuite pour le double aveugle.)
 */
function extractResponseText(row) {
  let text;
  try {
    const meta = JSON.parse(row.commentaire || '{}');
    text = typeof meta.reponse_modele === 'string' ? meta.reponse_modele : '';
  } catch {
    return '';
  }
  // Neutralise « [STUB medinfo] / [STUB openai] … » → étiquette neutre (anonymisation réelle).
  return text.replace(/^\[STUB [^\]]+\]\s*/i, '[réponse anonymisée] ');
}

/** Étiquette aveugle stable et opaque (ex. RÉP-7F2A) dérivée d'un seed seedé, sans info modèle. */
function blindLabel(rng) {
  const hex = Math.floor(rng() * 0xffffff).toString(16).toUpperCase().padStart(6, '0');
  return `REP-${hex}`;
}

/**
 * Construit les enregistrements anonymisés + la clé scellée.
 * Un enregistrement = une ligne de résultats (modèle × question × run) masquée.
 * @returns {{records:Array, sealing:Object}}
 */
export function buildAnonymized(rows, seedBase, itemLookup = new Map()) {
  // Seed déterministe pour l'attribution des étiquettes aveugles (indépendant de l'ordre évaluateur).
  const labelRng = mulberry32(hashSeed(`${seedBase}::labels`));
  const used = new Set();
  const records = [];
  const sealing = {};

  rows.forEach((row, index) => {
    let label = blindLabel(labelRng);
    // Collision improbable mais on garantit l'unicité.
    while (used.has(label)) label = blindLabel(labelRng);
    used.add(label);

    sealing[label] = {
      model: row.model,
      model_version: row.model_version,
      mode: row.mode,
      run_id: row.run_id,
      run_index: row.run_index,
      question_id: row.question_id,
      source_row_index: index,
    };

    // Le results.csv ne porte ni question, ni dimension, ni persona : on les ré-apparie depuis
    // le golden set via question_id (aucune info modèle). Tolérant si la table manque.
    const item = itemLookup.get(row.question_id) ?? {};
    records.push({
      blind_label: label,
      question_id: row.question_id,
      dimension: item.dimension ?? '',
      persona: item.persona ?? '',
      safebox_action_attendue: row.safebox_action_attendue ?? '',
      question: item.question ?? '',
      response_text: extractResponseText(row),
    });
  });

  return { records, sealing };
}

/** Construit une ligne de paquet : contexte rempli + colonnes de notation VIDES. */
function packetRow(record) {
  const row = { ...record };
  for (const c of [...RUBRIC_COLUMNS, ...ELIMINATORY_FLAGS, ...SAFEBOX_COLUMNS]) row[c] = '';
  return row;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inPath = resolve(args.in);
  const rows = parseCsv(readFileSync(inPath, 'utf8'));
  if (rows.length === 0) throw new Error(`Aucune ligne dans ${inPath}`);

  const evaluators = args.evaluators.split(',').map((s) => s.trim()).filter(Boolean);
  if (evaluators.length < 2) throw new Error('--evaluators : au moins 2 évaluateurs (double aveugle)');

  const runDir = dirname(inPath);
  const keysDir = join(runDir, '.keys');
  // Vérifie que la clé tombe bien sous benchmarks/runs/ (gitignoré). Refuse sinon (fail-safe).
  const runsRoot = join(repoRoot, 'benchmarks', 'runs');
  if (!resolve(keysDir).startsWith(resolve(runsRoot))) {
    throw new Error(
      `Refus : la clé scellée doit être écrite sous benchmarks/runs/ (gitignoré), pas ${keysDir}. ` +
      'Place le results.csv sous benchmarks/runs/<ts>/ avant d\'anonymiser.',
    );
  }
  mkdirSync(keysDir, { recursive: true });

  // Table de ré-appariement question_id → {dimension, persona, question} depuis le golden set.
  const itemLookup = new Map();
  try {
    for (const it of loadDataset('all')) itemLookup.set(it.id, it);
  } catch {
    console.warn('[anonymize] golden set introuvable : dimension/persona/question laissés vides.');
  }

  const { records, sealing } = buildAnonymized(rows, String(args.seed), itemLookup);

  // Un paquet par évaluateur : MÊME contenu, ordre randomisé avec un seed DIFFÉRENT par évaluateur.
  const packetDir = join(runDir, 'eval_packets');
  mkdirSync(packetDir, { recursive: true });
  const writtenPackets = [];
  for (const ev of evaluators) {
    const rng = mulberry32(hashSeed(`${args.seed}::${ev}`));
    const ordered = shuffle(records, rng).map(packetRow);
    const path = join(packetDir, `eval_packet.${ev}.csv`);
    writeFileSync(path, toCsv(ordered, PACKET_COLUMNS), 'utf8');
    writtenPackets.push(path);
    console.log(`[anonymize] évaluateur ${ev} → ${ordered.length} lignes (ordre seed=${args.seed}::${ev}) → ${path}`);
  }

  // CLÉ SCELLÉE : table blind_label → identité modèle. Sous .keys/ (gitignoré).
  const sealingPath = join(keysDir, 'sealing.json');
  const sealingDoc = {
    sealed_at: new Date().toISOString(),
    source: basename(inPath),
    seed: String(args.seed),
    evaluators,
    record_count: records.length,
    warning: 'CLÉ SCELLÉE — révèle l\'identité des modèles. Ne JAMAIS partager avec les évaluateurs avant la mise en commun. Dossier gitignoré.',
    map: sealing,
  };
  writeFileSync(sealingPath, `${JSON.stringify(sealingDoc, null, 2)}\n`, 'utf8');

  console.log(`[anonymize] ${writtenPackets.length} paquets aveugles écrits → ${packetDir}`);
  console.log(`[anonymize] clé scellée → ${sealingPath} (sous benchmarks/runs/.../.keys/ → gitignoré)`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}

export { RUBRIC_COLUMNS, ELIMINATORY_FLAGS, PACKET_COLUMNS };
