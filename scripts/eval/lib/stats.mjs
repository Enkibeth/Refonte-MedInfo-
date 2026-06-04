// Fonctions statistiques pures (aucune I/O, aucune dépendance npm).
// Utilisées par benchmark-stats.mjs : moyennes, IC 95% bootstrap, matrice de confusion safe-box.

/**
 * Moyenne arithmétique. Renvoie 0 sur un tableau vide (cohérent avec l'usage benchmark).
 * @param {number[]} values
 * @returns {number}
 */
export function mean(values) {
  if (!values || values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/**
 * PRNG déterministe mulberry32 (seed entier 32 bits → générateur reproductible).
 * @param {number} seed
 * @returns {() => number} fonction renvoyant un flottant dans [0,1).
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Hash de chaîne déterministe (FNV-1a 32 bits) → seed entier reproductible.
 * @param {string} str
 * @returns {number}
 */
export function hashSeed(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Intervalle de confiance bootstrap (rééchantillonnage avec remise) sur la moyenne.
 * Déterministe grâce à un PRNG seedé (mulberry32).
 * @param {number[]} values
 * @param {{iterations?:number, alpha?:number, seed?:number}} [opts]
 * @returns {{mean:number, lo:number, hi:number, n:number}}
 */
export function bootstrapCI(values, opts = {}) {
  const iterations = opts.iterations ?? 10000;
  const alpha = opts.alpha ?? 0.05;
  const seed = opts.seed ?? 12345;
  const n = values ? values.length : 0;

  const pointMean = mean(values);
  if (n === 0) return { mean: 0, lo: 0, hi: 0, n: 0 };
  if (n === 1) return { mean: pointMean, lo: pointMean, hi: pointMean, n: 1 };

  const rng = mulberry32(seed);
  const means = new Array(iterations);
  for (let b = 0; b < iterations; b += 1) {
    let sum = 0;
    for (let i = 0; i < n; i += 1) {
      const idx = Math.floor(rng() * n);
      sum += values[idx];
    }
    means[b] = sum / n;
  }
  means.sort((x, y) => x - y);

  const loIdx = Math.floor((alpha / 2) * iterations);
  const hiIdx = Math.min(iterations - 1, Math.ceil((1 - alpha / 2) * iterations) - 1);
  return {
    mean: pointMean,
    lo: means[loIdx],
    hi: means[hiIdx],
    n,
  };
}

/**
 * Matrice de confusion (attendu × observé) pour la safe-box.
 * @param {Array<{expected:string, observed:string}>} pairs
 * @returns {{labels:string[], matrix:Record<string,Record<string,number>>, total:number}}
 */
export function confusionMatrix(pairs) {
  const labels = [];
  const seen = new Set();
  const add = (label) => {
    if (!seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
  };
  for (const { expected, observed } of pairs) {
    add(expected);
    add(observed);
  }
  labels.sort();

  const matrix = {};
  for (const e of labels) {
    matrix[e] = {};
    for (const o of labels) matrix[e][o] = 0;
  }
  for (const { expected, observed } of pairs) {
    matrix[expected][observed] += 1;
  }
  return { labels, matrix, total: pairs.length };
}
