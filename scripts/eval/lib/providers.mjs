// Adaptateurs de modèles derrière une interface commune (aucune dépendance hors stdlib + AI SDK déjà présent).
//
// Interface : async function generate({ model, prompt, systemPrompt, temperature, item })
//   → { text, model, model_version, latency_ms, tokens_in, tokens_out }
//
// Invariants :
//  - Mode hors-ligne par défaut : sans `--live` ou sans clé, on utilise le provider STUB
//    déterministe (réponses canned seedées sur un hash de la question). AUCUN appel réseau.
//  - On n'appelle un vrai provider (openai / anthropic via le Vercel AI SDK) QUE si
//    { live: true } ET la clé d'API correspondante est présente dans l'environnement.
//  - Le harness est un OUTIL d'évaluation : il ne contient AUCUNE logique médicale.
//    Le stub « medinfo » se contente d'appliquer la règle de refus canonique selon
//    `action_attendue` (stimuli de test du refus), sans rien interpréter cliniquement.

import { getCanonicalRefusal } from './refusal.mjs';
import { hashSeed, mulberry32 } from './stats.mjs';

/** Compte approximatif de tokens (heuristique mots×1.3) — suffisant pour le stub et le log. */
function estimateTokens(text) {
  if (!text) return 0;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words * 1.3));
}

/** Latence pseudo-aléatoire déterministe (ms) dérivée d'un seed, pour des logs reproductibles. */
function deterministicLatency(seed) {
  const rng = mulberry32(seed);
  // Plage 80–520 ms, stable pour un même seed.
  return Math.round(80 + rng() * 440);
}

/**
 * Provider STUB déterministe générique.
 * Renvoie une réponse canned reproductible seedée sur (model + prompt).
 * Ne contient AUCUNE connaissance médicale : c'est un placeholder de test du pipeline.
 */
function makeStubProvider(modelName, versionLabel) {
  return async function generate({ model, prompt, temperature }) {
    const seed = hashSeed(`${model}::${prompt}`);
    const rng = mulberry32(seed);
    // Réponse générique stub : déterministe, non médicale.
    const tag = (rng() * 1e9).toString(36).slice(0, 6);
    const text =
      `[STUB ${modelName}] Réponse d'information générale simulée (déterministe, seed ${tag}). ` +
      `Ce texte est un placeholder de test du harness et ne contient aucune information médicale réelle.`;
    return {
      text,
      model: model ?? modelName,
      model_version: versionLabel,
      latency_ms: deterministicLatency(seed),
      tokens_in: estimateTokens(prompt),
      tokens_out: estimateTokens(text),
    };
  };
}

/**
 * Provider STUB « medinfo » : applique la règle de refus canonique.
 * Pour tout item dont `action_attendue` commence par `refus_`, renvoie le message de refus
 * canonique VERBATIM (chargé depuis docs/01_REGULATION.md §4). Sinon, réponse générique stub.
 * Le suffixe de variante (3114 / urgence) ne change PAS le texte : le message canonique unique
 * couvre déjà 15/112 et 3114 ; on ne fabrique aucun message concurrent.
 */
function makeMedinfoStub(modelName, versionLabel) {
  const generic = makeStubProvider(modelName, versionLabel);
  return async function generate(args) {
    const action = args.item?.action_attendue ?? '';
    if (action.startsWith('refus_')) {
      const text = getCanonicalRefusal();
      const seed = hashSeed(`${args.model}::${args.prompt}`);
      return {
        text,
        model: args.model ?? modelName,
        model_version: versionLabel,
        latency_ms: deterministicLatency(seed),
        tokens_in: estimateTokens(args.prompt),
        tokens_out: estimateTokens(text),
      };
    }
    return generic(args);
  };
}

/**
 * Provider réel via le Vercel AI SDK (import dynamique pour rester hors-ligne par défaut).
 * @param {'openai'|'anthropic'} family
 * @param {string} defaultModelVersion identifiant exact du modèle (figé le jour J)
 */
function makeLiveProvider(family, defaultModelVersion) {
  return async function generate({ model, prompt, systemPrompt, temperature }) {
    const { generateText } = await import('ai');
    let languageModel;
    const modelId = model && model.includes('/') ? model.split('/').slice(1).join('/') : defaultModelVersion;
    if (family === 'openai') {
      const { openai } = await import('@ai-sdk/openai');
      languageModel = openai(modelId);
    } else {
      const { anthropic } = await import('@ai-sdk/anthropic');
      languageModel = anthropic(modelId);
    }
    const started = Date.now();
    const result = await generateText({
      model: languageModel,
      system: systemPrompt || undefined,
      prompt,
      temperature: temperature ?? 0,
    });
    const latency = Date.now() - started;
    return {
      text: result.text ?? '',
      model: model ?? family,
      model_version: modelId,
      latency_ms: latency,
      tokens_in: result.usage?.inputTokens ?? estimateTokens(prompt),
      tokens_out: result.usage?.outputTokens ?? estimateTokens(result.text ?? ''),
    };
  };
}

/** Vrai ? indique si une clé d'API est présente pour la famille donnée. */
export function hasApiKey(family) {
  if (family === 'openai') return Boolean(process.env.OPENAI_API_KEY);
  if (family === 'anthropic') return Boolean(process.env.ANTHROPIC_API_KEY);
  return false;
}

// Versions stub étiquetées clairement comme telles (jamais confondues avec un identifiant figé réel).
const STUB_VERSIONS = {
  medinfo: 'medinfo-public-v2.0.0-stub',
  'medinfo-rag': 'medinfo-public-v2.0.0-rag-stub',
  openai: 'openai-stub',
  anthropic: 'anthropic-stub',
};

// Identifiants de modèles réels par défaut (à figer le jour J via --models famille/identifiant).
const LIVE_DEFAULTS = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-5',
};

/**
 * Registre de providers. Renvoie un adaptateur `generate` pour un nom de modèle donné.
 * En mode hors-ligne (live=false) ou si la clé manque, retombe TOUJOURS sur un stub déterministe.
 * @param {string} name medinfo | medinfo-rag | openai | anthropic
 * @param {{live?:boolean}} [opts]
 * @returns {{ generate: Function, kind: 'stub'|'live', family: string }}
 */
export function getProvider(name, opts = {}) {
  const live = Boolean(opts.live);
  const family = name === 'medinfo' || name === 'medinfo-rag' ? 'medinfo' : name;

  // medinfo / medinfo-rag : toujours en stub (pas de backend réel branché dans ce harness).
  if (family === 'medinfo') {
    return { generate: makeMedinfoStub(name, STUB_VERSIONS[name] ?? `${name}-stub`), kind: 'stub', family: 'medinfo' };
  }

  // Comparateurs externes : réel uniquement si --live ET clé présente.
  if ((family === 'openai' || family === 'anthropic') && live && hasApiKey(family)) {
    return { generate: makeLiveProvider(family, LIVE_DEFAULTS[family]), kind: 'live', family };
  }

  // Sinon stub déterministe (CI-safe).
  return { generate: makeStubProvider(name, STUB_VERSIONS[name] ?? `${name}-stub`), kind: 'stub', family };
}
