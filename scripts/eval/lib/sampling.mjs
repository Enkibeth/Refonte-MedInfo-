// Échantillonnage stratifié déterministe (PUR, aucune I/O). Phase 3 — run pilote.
// Réutilise mulberry32/hashSeed (lib/stats.mjs) pour TOUT déterminisme : pas de Math.random.
//
// But : tirer ~n items en respectant les proportions des strates (ex. ['dimension','gravite'])
// afin que le pilote couvre la même structure que le golden set complet, de façon reproductible.

import { hashSeed, mulberry32 } from './stats.mjs';

/**
 * Mélange déterministe (Fisher–Yates) d'un tableau via un PRNG seedé. Ne mute pas l'entrée.
 * @param {Array} arr
 * @param {() => number} rng
 * @returns {Array} copie mélangée
 */
function shuffle(arr, rng) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/**
 * Échantillon stratifié déterministe.
 *
 * Algorithme :
 *  1. Partitionne les items par clé de strate (combinaison des champs `strata`).
 *  2. Alloue à chaque strate un quota proportionnel à sa taille : round(n · taille/total).
 *  3. Tire les items de chaque strate après mélange seedé (reproductible).
 *  4. Ajuste pour atteindre exactement min(n, total) en complétant/retirant
 *     selon les plus grands restes (méthode du plus fort reste), de façon déterministe.
 *  5. Renvoie les items dans leur ordre d'origine (stable) — l'anonymisation re-randomise ailleurs.
 *
 * @template T
 * @param {T[]} items
 * @param {{n:number, strata?:string[], seed?:number|string}} opts
 * @returns {T[]} sous-ensemble reproductible
 */
export function stratifiedSample(items, opts = {}) {
  const all = Array.isArray(items) ? items : [];
  const total = all.length;
  const n = Math.max(0, Math.min(opts.n ?? total, total));
  if (n === 0) return [];
  if (n === total) return all.slice();

  const strata = Array.isArray(opts.strata) && opts.strata.length > 0 ? opts.strata : [];
  const seed = typeof opts.seed === 'string' ? hashSeed(opts.seed) : (opts.seed ?? 12345);
  const rng = mulberry32(seed >>> 0);

  // Sans strate : simple tirage seedé en conservant l'ordre d'origine.
  if (strata.length === 0) {
    return pickByOriginalOrder(all, n, rng);
  }

  // 1) Partition.
  const groups = new Map();
  all.forEach((item, idx) => {
    const key = strata.map((f) => `${f}=${item[f] ?? '∅'}`).join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(idx);
  });

  // Ordre de strate stable (tri par clé) pour un quota reproductible indépendant de l'ordre d'insertion.
  const keys = [...groups.keys()].sort();

  // 2) Quotas proportionnels (plancher) + restes.
  const quotas = [];
  let allocated = 0;
  for (const key of keys) {
    const size = groups.get(key).length;
    const exact = (n * size) / total;
    const floor = Math.floor(exact);
    quotas.push({ key, size, floor, frac: exact - floor, take: Math.min(floor, size) });
    allocated += Math.min(floor, size);
  }

  // 4) Plus forts restes pour combler n − allocated (en respectant la taille de strate).
  let remaining = n - allocated;
  const byFrac = quotas
    .map((q, i) => ({ i, frac: q.frac, room: q.size - q.take, key: q.key }))
    .filter((q) => q.room > 0)
    .sort((a, b) => (b.frac - a.frac) || (a.key < b.key ? -1 : 1));
  let cursor = 0;
  while (remaining > 0 && byFrac.length > 0) {
    const slot = byFrac[cursor % byFrac.length];
    if (quotas[slot.i].take < quotas[slot.i].size) {
      quotas[slot.i].take += 1;
      remaining -= 1;
    }
    cursor += 1;
    // Garde-fou anti-boucle : si plus aucune place, on s'arrête.
    if (cursor > byFrac.length * (n + 1)) break;
  }

  // 3) Tirage dans chaque strate (mélange seedé), puis union triée par index d'origine.
  const chosen = new Set();
  for (const q of quotas) {
    if (q.take <= 0) continue;
    const indices = groups.get(q.key);
    const shuffled = shuffle(indices, rng);
    for (let k = 0; k < q.take && k < shuffled.length; k += 1) chosen.add(shuffled[k]);
  }

  // 5) Si arrondis laissent un léger déficit (n non atteint), compléter de façon seedée.
  if (chosen.size < n) {
    const rest = shuffle(all.map((_, idx) => idx).filter((idx) => !chosen.has(idx)), rng);
    for (let k = 0; chosen.size < n && k < rest.length; k += 1) chosen.add(rest[k]);
  }

  return all.filter((_, idx) => chosen.has(idx));
}

/** Tirage seedé de n items rendus dans l'ordre d'origine (cas sans strate). */
function pickByOriginalOrder(all, n, rng) {
  const idx = shuffle(all.map((_, i) => i), rng).slice(0, n);
  const keep = new Set(idx);
  return all.filter((_, i) => keep.has(i));
}

export { shuffle };
