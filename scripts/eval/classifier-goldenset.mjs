#!/usr/bin/env node
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const goldenPath = join(repoRoot, 'tests/classifier/golden/golden-set.fr.jsonl');
const classifierDir = join(repoRoot, 'src/ai/classifier');
const intents = ['general_info', 'personal_symptoms', 'emergency', 'out_of_scope', 'ambiguous'];
const blockingTargets = [
  { label: 'emergency recall', className: 'emergency', metric: 'recall', minimum: 0.99 },
  { label: 'personal_symptoms recall', className: 'personal_symptoms', metric: 'recall', minimum: 0.97 },
  { label: 'general_info précision', className: 'general_info', metric: 'precision', minimum: 0.95 },
];

process.env.OPENAI_API_KEY = '';
process.env.ANTHROPIC_API_KEY = '';
process.env.GOOGLE_GENERATIVE_AI_API_KEY = '';
process.env.GEMINI_API_KEY = '';
process.env.MEDINFO_CLASSIFIER_DISABLE_LLM = '1';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

function parseJsonl(path) {
  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      let row;
      try {
        row = JSON.parse(line);
      } catch (error) {
        throw new Error(`JSON invalide ligne ${index + 1}: ${error.message}`);
      }
      if (typeof row.message !== 'string' || !intents.includes(row.expected) || typeof row.adversarial !== 'boolean') {
        throw new Error(`Schéma invalide ligne ${index + 1}`);
      }
      return { ...row, line: index + 1 };
    });
}

function normalizeIntent(value) {
  if (!value) return undefined;
  if (typeof value === 'string') return intents.includes(value) ? value : undefined;
  if (typeof value === 'object') {
    for (const key of ['category', 'intent', 'expected', 'classification']) {
      if (typeof value[key] === 'string' && intents.includes(value[key])) return value[key];
    }
  }
  return undefined;
}

function loadTsAsCommonJs(entryPath) {
  const ts = require('typescript');
  const cache = new Map();

  function resolveLocal(request, parentFile) {
    // Honore l'alias `@/` du projet (tsconfig.json + vitest.config.ts → `src/`).
    let base;
    if (request === '@' || request.startsWith('@/')) {
      base = resolve(repoRoot, 'src', request.slice(request.indexOf('/') + 1));
    } else if (request.startsWith('.')) {
      base = resolve(dirname(parentFile), request);
    } else {
      return request;
    }
    const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, join(base, 'index.ts'), join(base, 'index.tsx'), join(base, 'index.js'), join(base, 'index.mjs')];
    const found = candidates.find((candidate) => existsSync(candidate));
    if (!found) throw new Error(`Module local introuvable: ${request} depuis ${parentFile}`);
    return found;
  }

  function loadModule(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    if (extname(filename) === '.js' || extname(filename) === '.mjs') return require(filename);

    const module = { exports: {} };
    cache.set(filename, module);
    const source = readFileSync(filename, 'utf8');
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
        jsx: ts.JsxEmit.ReactJSX,
      },
      fileName: filename,
    });
    const localRequire = (request) => {
      const resolvedRequest = resolveLocal(request, filename);
      return resolvedRequest === request ? require(request) : loadModule(resolvedRequest);
    };
    const context = vm.createContext({
      require: localRequire,
      module,
      exports: module.exports,
      __dirname: dirname(filename),
      __filename: filename,
      process,
      console,
      Buffer,
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      URL,
    });
    new vm.Script(outputText, { filename }).runInContext(context);
    return module.exports;
  }

  return loadModule(entryPath);
}

async function loadClassifier() {
  const candidates = [
    'index.mjs',
    'index.js',
    'classifier.mjs',
    'classifier.js',
    'index.ts',
    'classifier.ts',
  ].map((name) => join(classifierDir, name));

  const entry = candidates.find((candidate) => existsSync(candidate));
  if (!entry) {
    throw new Error(`Aucun export classifieur trouvé dans ${classifierDir}`);
  }

  const moduleExports = ['.mjs', '.js'].includes(extname(entry))
    ? await import(pathToFileURL(entry).href)
    : loadTsAsCommonJs(entry);

  if (typeof moduleExports.classifyByRegex !== 'function' || typeof moduleExports.classifyIntent !== 'function') {
    throw new Error(`Le module ${entry} doit exporter classifyByRegex et classifyIntent`);
  }
  return moduleExports;
}

async function classifyMessage(classifier, message) {
  const regexResult = await classifier.classifyByRegex(message);
  const regexIntent = normalizeIntent(regexResult);
  if (regexIntent && regexIntent !== 'general_info') return regexIntent;

  try {
    const intentResult = await classifier.classifyIntent(message, {
      disableLlm: true,
      disableLLM: true,
      enableLlm: false,
      enableLLM: false,
      useLlm: false,
      useLLM: false,
      stage2: false,
      llm: false,
      failSafe: true,
      mode: 'regex-only',
    });
    return normalizeIntent(intentResult) ?? regexIntent ?? 'ambiguous';
  } catch {
    return regexIntent ?? 'ambiguous';
  }
}

function pct(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function printTable(metrics) {
  const rows = intents.map((intent) => ({ intent, ...metrics[intent] }));
  const widths = {
    classe: Math.max('Classe'.length, ...rows.map((row) => row.intent.length)),
    recall: 'Recall'.length,
    precision: 'Précision'.length,
    support: 'Support'.length,
    tp: 'TP'.length,
    fp: 'FP'.length,
    fn: 'FN'.length,
  };
  const line = `| ${'Classe'.padEnd(widths.classe)} | Recall   | Précision | Support | TP | FP | FN |`;
  const sep = `| ${'-'.repeat(widths.classe)} | -------- | --------- | ------- | -- | -- | -- |`;
  console.log(line);
  console.log(sep);
  for (const row of rows) {
    console.log(`| ${row.intent.padEnd(widths.classe)} | ${pct(row.recall).padStart(8)} | ${pct(row.precision).padStart(9)} | ${String(row.support).padStart(7)} | ${String(row.tp).padStart(2)} | ${String(row.fp).padStart(2)} | ${String(row.fn).padStart(2)} |`);
  }
}

async function main() {
  const examples = parseJsonl(goldenPath);
  const adversarialCount = examples.filter((example) => example.adversarial).length;
  console.log(`Golden set: ${examples.length} exemples (${adversarialCount} adversariaux, ${pct(adversarialCount / examples.length)})`);

  const classifier = await loadClassifier();
  const predictions = [];
  for (const example of examples) {
    const predicted = await classifyMessage(classifier, example.message);
    predictions.push({ ...example, predicted });
  }

  const metrics = Object.fromEntries(intents.map((intent) => [intent, { tp: 0, fp: 0, fn: 0, support: 0, recall: 0, precision: 0 }]));
  for (const prediction of predictions) {
    metrics[prediction.expected].support += 1;
    if (prediction.predicted === prediction.expected) {
      metrics[prediction.expected].tp += 1;
    } else {
      metrics[prediction.expected].fn += 1;
      if (metrics[prediction.predicted]) metrics[prediction.predicted].fp += 1;
    }
  }
  for (const intent of intents) {
    const m = metrics[intent];
    m.recall = m.support === 0 ? 0 : m.tp / m.support;
    m.precision = m.tp + m.fp === 0 ? 0 : m.tp / (m.tp + m.fp);
  }

  printTable(metrics);

  console.log('\nCibles bloquantes:');
  let failed = false;
  for (const target of blockingTargets) {
    const actual = metrics[target.className][target.metric];
    const ok = actual >= target.minimum;
    failed ||= !ok;
    console.log(`${ok ? '✓' : '✗'} ${target.label}: ${pct(actual)} / cible ${pct(target.minimum)}`);
  }

  const severeFalseNegatives = predictions.filter((prediction) => ['personal_symptoms', 'emergency'].includes(prediction.expected) && prediction.predicted !== prediction.expected);
  if (severeFalseNegatives.length > 0) {
    console.log('\nFaux négatifs personal_symptoms/emergency (à prioriser pour itérer le lexique):');
    for (const item of severeFalseNegatives.slice(0, 50)) {
      console.log(`- L${item.line} expected=${item.expected} predicted=${item.predicted} adversarial=${item.adversarial}: ${item.message}`);
    }
    if (severeFalseNegatives.length > 50) console.log(`… ${severeFalseNegatives.length - 50} autres faux négatifs masqués`);
  } else {
    console.log('\nAucun faux négatif personal_symptoms/emergency.');
  }

  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
