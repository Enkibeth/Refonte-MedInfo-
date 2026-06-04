// Fonctions d'accord inter-évaluateurs et de calibration juge↔humain (PURES, aucune I/O).
// Utilisées par benchmark-agreement.mjs (Phase 3). Aucune dépendance npm.
//
// Référence méthodo : docs/10_BENCHMARK.md §10 (κ de Cohen) et §11 (calibration juge/humain,
// biais de longueur, biais systématique). Aucune logique médicale ici : pure statistique.

/**
 * κ de Cohen (non pondéré) pour deux annotateurs sur des labels catégoriels.
 *
 * Formule : κ = (po − pe) / (1 − pe)
 *   - po = accord observé = proportion de paires où A == B.
 *   - pe = accord attendu par hasard = Σ_k (p_A(k) · p_B(k)), où p_A(k) et p_B(k)
 *     sont les fréquences marginales du label k chez A et chez B.
 * Interprétation : κ=1 accord parfait ; κ≈0 accord = hasard ; κ<0 accord pire que le hasard.
 * Cas limite : si pe=1 (un seul label utilisé par les deux et accord total), on renvoie 1.
 *
 * @param {Array<string|number|boolean>} labelsA
 * @param {Array<string|number|boolean>} labelsB
 * @returns {number} κ ∈ [−1, 1]
 */
export function cohenKappa(labelsA, labelsB) {
  if (!labelsA || !labelsB || labelsA.length !== labelsB.length) {
    throw new Error('cohenKappa : les deux tableaux doivent avoir la même longueur non nulle.');
  }
  const n = labelsA.length;
  if (n === 0) return 0;

  const a = labelsA.map(normLabel);
  const b = labelsB.map(normLabel);

  // Accord observé.
  let agree = 0;
  for (let i = 0; i < n; i += 1) if (a[i] === b[i]) agree += 1;
  const po = agree / n;

  // Marges par label.
  const countA = new Map();
  const countB = new Map();
  const labels = new Set();
  for (let i = 0; i < n; i += 1) {
    countA.set(a[i], (countA.get(a[i]) ?? 0) + 1);
    countB.set(b[i], (countB.get(b[i]) ?? 0) + 1);
    labels.add(a[i]);
    labels.add(b[i]);
  }

  // Accord attendu par hasard.
  let pe = 0;
  for (const k of labels) {
    const pa = (countA.get(k) ?? 0) / n;
    const pb = (countB.get(k) ?? 0) / n;
    pe += pa * pb;
  }

  if (pe >= 1) {
    // Accord parfait forcé (un seul label des deux côtés) : κ défini comme 1 si po==1, sinon 0.
    return po === 1 ? 1 : 0;
  }
  return (po - pe) / (1 - pe);
}

/** Normalise un label en chaîne stable (true/false/nombres → string) pour la comparaison d'égalité. */
function normLabel(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v).trim();
}

/**
 * Coefficient de corrélation de Pearson entre deux séries numériques de même longueur.
 * Renvoie 0 si une série est constante (variance nulle → corrélation indéfinie).
 *
 * @param {number[]} x
 * @param {number[]} y
 * @returns {number} r ∈ [−1, 1]
 */
export function pearson(x, y) {
  if (!x || !y || x.length !== y.length) {
    throw new Error('pearson : les deux séries doivent avoir la même longueur.');
  }
  const n = x.length;
  if (n === 0) return 0;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i += 1) {
    sx += x[i];
    sy += y[i];
  }
  const mx = sx / n;
  const my = sy / n;
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  if (denom === 0) return 0;
  return num / denom;
}

/**
 * Libellé qualitatif de la force d'accord d'un κ (échelle usuelle Landis & Koch 1977).
 * @param {number} kappa
 * @returns {string}
 */
export function agreementStrength(kappa) {
  if (Number.isNaN(kappa)) return 'indéfini';
  if (kappa < 0) return 'désaccord (pire que le hasard)';
  if (kappa < 0.2) return 'négligeable';
  if (kappa < 0.4) return 'faible';
  if (kappa < 0.6) return 'modéré';
  if (kappa < 0.8) return 'fort';
  return 'quasi parfait';
}

/**
 * Biais systématique linéaire moyen du juge par rapport à l'humain : moyenne de (judge − human).
 * Positif → le juge sur-note ; négatif → il sous-note. Détecte un décalage constant (pas la dispersion).
 *
 * @param {number[]} judge
 * @param {number[]} human
 * @returns {number} biais moyen (mêmes unités que les scores)
 */
export function linearBias(judge, human) {
  if (!judge || !human || judge.length !== human.length) {
    throw new Error('linearBias : les deux séries doivent avoir la même longueur.');
  }
  const n = judge.length;
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i += 1) sum += judge[i] - human[i];
  return sum / n;
}
