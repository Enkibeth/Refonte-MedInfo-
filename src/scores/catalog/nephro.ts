/**
 * Scores / formules NÉPHROLOGIE & MÉTABOLIQUE.
 * Débit de filtration glomérulaire, clairance, corrections ioniques, osmolalité, FENa.
 *
 * ⚠️ Les créatininémies sont saisies en µmol/L (usage FR) et converties en mg/dL
 * dans les formules (÷ 88,4). Chaque formule est couverte par un test.
 */
import { fmt, type ScoreDefinition, type ScoreInterpretation } from '../types';

const UMOL_TO_MGDL = 1 / 88.4; // créatinine : µmol/L → mg/dL

/** Interprétation KDIGO d'un DFG / clairance (mL/min[/1,73 m²]). */
function renalInterpretation(gfr: number, normalized: boolean): ScoreInterpretation {
  const u = normalized ? 'mL/min/1,73 m²' : 'mL/min';
  if (gfr >= 90) return { level: 'low', label: 'Fonction normale (G1)', detail: `DFG ≥ 90 ${u} : fonction rénale normale (à interpréter avec l’albuminurie).` };
  if (gfr >= 60) return { level: 'low', label: 'Légèrement diminuée (G2)', detail: `DFG 60–89 ${u} : fonction légèrement diminuée.` };
  if (gfr >= 45) return { level: 'moderate', label: 'IRC modérée (G3a)', detail: `DFG 45–59 ${u} : insuffisance rénale chronique modérée.` };
  if (gfr >= 30) return { level: 'moderate', label: 'IRC modérée à sévère (G3b)', detail: `DFG 30–44 ${u} : adapter les posologies néphrotoxiques, avis néphrologique.` };
  if (gfr >= 15) return { level: 'high', label: 'IRC sévère (G4)', detail: `DFG 15–29 ${u} : préparer la suppléance, avis néphrologique.` };
  return { level: 'critical', label: 'IRC terminale (G5)', detail: `DFG < 15 ${u} : insuffisance rénale terminale.` };
}

const incompleteResult = (msg: string): ReturnType<ScoreDefinition['compute']> => ({
  value: NaN,
  display: '—',
  incomplete: true,
  interpretation: { level: 'info', label: 'Champs à compléter', detail: msg },
});

export const NEPHRO_SCORES: ScoreDefinition[] = [
  {
    id: 'ckd-epi',
    name: 'DFG estimé — CKD-EPI 2021 (sans variable ethnique)',
    acronym: 'CKD-EPI',
    category: 'nephro',
    purpose:
      "Estime le débit de filtration glomérulaire à partir de la créatininémie pour dépister et stader l'insuffisance rénale chronique.",
    aliases: ['ckd epi', 'ckd-epi', 'dfg', 'débit de filtration glomérulaire', 'clairance créatinine estimée'],
    keywords: [
      'insuffisance rénale',
      'fonction rénale',
      'créatinine',
      'clairance',
      'DFG',
      'néphrologie',
      'stade IRC',
    ],
    fields: [
      { kind: 'number', id: 'creat', label: 'Créatininémie', unit: 'µmol/L', min: 10, max: 2000, placeholder: 'ex. 90' },
      { kind: 'number', id: 'age', label: 'Âge', unit: 'ans', min: 18, max: 120, placeholder: 'ex. 60' },
      {
        kind: 'choice',
        id: 'sex',
        label: 'Sexe',
        options: [
          { label: 'Homme', value: 0 },
          { label: 'Femme', value: 1 },
        ],
      },
    ],
    reference: 'Inker 2021 (CKD-EPI creat, race-free). Recommandée en France depuis 2023.',
    caution: 'Non valable en insuffisance rénale aiguë, grossesse, masse musculaire extrême, amputation.',
    compute: (v) => {
      const scr = v.creat * UMOL_TO_MGDL;
      const age = v.age;
      if (!Number.isFinite(scr) || scr <= 0 || !Number.isFinite(age) || age <= 0) {
        return incompleteResult('Renseignez la créatininémie et l’âge.');
      }
      const female = v.sex === 1;
      const kappa = female ? 0.7 : 0.9;
      const alpha = female ? -0.241 : -0.302;
      const ratio = scr / kappa;
      const gfr =
        142 *
        Math.pow(Math.min(ratio, 1), alpha) *
        Math.pow(Math.max(ratio, 1), -1.2) *
        Math.pow(0.9938, age) *
        (female ? 1.012 : 1);
      return { value: gfr, display: `${fmt(gfr)} mL/min/1,73 m²`, interpretation: renalInterpretation(gfr, true) };
    },
  },

  {
    id: 'cockcroft',
    name: 'Clairance de la créatinine — Cockcroft-Gault',
    acronym: 'Cockcroft-Gault',
    category: 'nephro',
    purpose:
      "Estime la clairance de la créatinine (non indexée à la surface corporelle) — reste la référence pour l'adaptation posologique de nombreux médicaments (AOD, aminosides…).",
    aliases: ['cockcroft', 'cockroft', 'cockcroft gault', 'clairance créatinine'],
    keywords: [
      'clairance',
      'créatinine',
      'fonction rénale',
      'adaptation posologique',
      'médicament',
      'AOD',
      'néphrologie',
    ],
    fields: [
      { kind: 'number', id: 'creat', label: 'Créatininémie', unit: 'µmol/L', min: 10, max: 2000, placeholder: 'ex. 90' },
      { kind: 'number', id: 'age', label: 'Âge', unit: 'ans', min: 18, max: 120, placeholder: 'ex. 60' },
      { kind: 'number', id: 'weight', label: 'Poids', unit: 'kg', min: 20, max: 250, placeholder: 'ex. 70' },
      {
        kind: 'choice',
        id: 'sex',
        label: 'Sexe',
        options: [
          { label: 'Homme', value: 1.23 },
          { label: 'Femme', value: 1.04 },
        ],
      },
    ],
    reference: 'Cockcroft & Gault 1976. Clairance en mL/min (non indexée à 1,73 m²).',
    caution: 'Peu fiable en cas d’obésité, de poids extrême ou de dénutrition ; préférer le poids ajusté si obésité.',
    compute: (v) => {
      const creat = v.creat;
      const age = v.age;
      const weight = v.weight;
      const k = v.sex;
      if (![creat, age, weight].every(Number.isFinite) || creat <= 0) {
        return incompleteResult('Renseignez créatininémie, âge et poids.');
      }
      const crcl = ((140 - age) * weight * k) / creat;
      return { value: crcl, display: `${fmt(crcl)} mL/min`, interpretation: renalInterpretation(crcl, false) };
    },
  },

  {
    id: 'mdrd',
    name: 'DFG estimé — MDRD (4 variables, IDMS)',
    acronym: 'MDRD',
    category: 'nephro',
    purpose:
      "Ancienne formule d'estimation du DFG à partir de la créatininémie ; largement remplacée par CKD-EPI mais encore rencontrée.",
    aliases: ['mdrd', 'mdrd simplifié'],
    keywords: ['DFG', 'insuffisance rénale', 'créatinine', 'clairance', 'fonction rénale', 'néphrologie'],
    fields: [
      { kind: 'number', id: 'creat', label: 'Créatininémie', unit: 'µmol/L', min: 10, max: 2000, placeholder: 'ex. 90' },
      { kind: 'number', id: 'age', label: 'Âge', unit: 'ans', min: 18, max: 120, placeholder: 'ex. 60' },
      {
        kind: 'choice',
        id: 'sex',
        label: 'Sexe',
        options: [
          { label: 'Homme', value: 0 },
          { label: 'Femme', value: 1 },
        ],
      },
    ],
    reference: 'Levey 2006 (MDRD IDMS, 175). Variable ethnique volontairement omise.',
    compute: (v) => {
      const scr = v.creat * UMOL_TO_MGDL;
      const age = v.age;
      if (!Number.isFinite(scr) || scr <= 0 || !Number.isFinite(age) || age <= 0) {
        return incompleteResult('Renseignez la créatininémie et l’âge.');
      }
      const female = v.sex === 1;
      const gfr = 175 * Math.pow(scr, -1.154) * Math.pow(age, -0.203) * (female ? 0.742 : 1);
      return { value: gfr, display: `${fmt(gfr)} mL/min/1,73 m²`, interpretation: renalInterpretation(gfr, true) };
    },
  },

  {
    id: 'calcemie-corrigee',
    name: 'Calcémie corrigée par l’albumine',
    acronym: 'Ca corrigée',
    category: 'nephro',
    purpose:
      "Corrige la calcémie totale en fonction de l'albuminémie, pour ne pas méconnaître une hypo/hypercalcémie masquée par une anomalie de l'albumine.",
    aliases: ['calcemie corrigee', 'calcium corrigé', 'ca corrige'],
    keywords: ['calcémie', 'calcium', 'hypocalcémie', 'hypercalcémie', 'albumine', 'ionogramme'],
    fields: [
      { kind: 'number', id: 'calcium', label: 'Calcémie totale', unit: 'mmol/L', min: 1, max: 5, step: 0.01, placeholder: 'ex. 2,15' },
      { kind: 'number', id: 'albumin', label: 'Albuminémie', unit: 'g/L', min: 10, max: 60, placeholder: 'ex. 30' },
    ],
    reference: 'Payne 1973. Ca corrigée = Ca + 0,02 × (40 − albumine[g/L]). Normale ≈ 2,20–2,60 mmol/L.',
    compute: (v) => {
      const ca = v.calcium;
      const alb = v.albumin;
      if (!Number.isFinite(ca) || !Number.isFinite(alb)) {
        return incompleteResult('Renseignez la calcémie et l’albuminémie.');
      }
      const corr = ca + 0.02 * (40 - alb);
      let interpretation: ScoreInterpretation;
      if (corr < 2.2) interpretation = { level: 'moderate', label: 'Hypocalcémie', detail: 'Calcémie corrigée < 2,20 mmol/L : hypocalcémie.' };
      else if (corr > 2.6) interpretation = { level: 'high', label: 'Hypercalcémie', detail: 'Calcémie corrigée > 2,60 mmol/L : hypercalcémie — rechercher la cause (PTH…).' };
      else interpretation = { level: 'low', label: 'Normale', detail: 'Calcémie corrigée dans les normes (2,20–2,60 mmol/L).' };
      return { value: corr, display: `${fmt(corr, 2)} mmol/L`, interpretation };
    },
  },

  {
    id: 'natremie-corrigee',
    name: 'Natrémie corrigée (hyperglycémie)',
    acronym: 'Na corrigée',
    category: 'nephro',
    purpose:
      "Corrige la natrémie mesurée en cas d'hyperglycémie (fausse hyponatrémie de transfert) pour évaluer la vraie natrémie.",
    aliases: ['natremie corrigee', 'sodium corrigé', 'na corrige', 'hyponatremie hyperglycemie'],
    keywords: ['natrémie', 'sodium', 'hyponatrémie', 'hyperglycémie', 'glycémie', 'ionogramme'],
    fields: [
      { kind: 'number', id: 'sodium', label: 'Natrémie mesurée', unit: 'mmol/L', min: 100, max: 180, placeholder: 'ex. 130' },
      { kind: 'number', id: 'glucose', label: 'Glycémie', unit: 'mmol/L', min: 2, max: 80, step: 0.1, placeholder: 'ex. 25' },
    ],
    reference: 'Katz 1973 (facteur ≈ 1,6 mmol/L Na par g/L de glucose). Na corrigée = Na + 0,3 × (glycémie − 5,5).',
    compute: (v) => {
      const na = v.sodium;
      const glc = v.glucose;
      if (!Number.isFinite(na) || !Number.isFinite(glc)) {
        return incompleteResult('Renseignez la natrémie et la glycémie.');
      }
      const corr = na + 0.3 * (glc - 5.5);
      let interpretation: ScoreInterpretation;
      if (corr < 135) interpretation = { level: 'moderate', label: 'Hyponatrémie vraie', detail: 'Natrémie corrigée < 135 mmol/L : hyponatrémie réelle.' };
      else if (corr > 145) interpretation = { level: 'moderate', label: 'Hypernatrémie', detail: 'Natrémie corrigée > 145 mmol/L : hypernatrémie.' };
      else interpretation = { level: 'low', label: 'Natrémie normale', detail: 'Natrémie corrigée normale : l’hyponatrémie mesurée était liée à l’hyperglycémie.' };
      return { value: corr, display: `${fmt(corr, 1)} mmol/L`, interpretation };
    },
  },

  {
    id: 'trou-anionique',
    name: 'Trou anionique',
    acronym: 'TA / anion gap',
    category: 'nephro',
    purpose:
      "Oriente le diagnostic d'une acidose métabolique (trou anionique augmenté vs normal).",
    aliases: ['trou anionique', 'anion gap', 'ta', 'acidose metabolique'],
    keywords: ['acidose', 'métabolique', 'ionogramme', 'bicarbonates', 'gaz du sang', 'chlore'],
    fields: [
      { kind: 'number', id: 'sodium', label: 'Natrémie', unit: 'mmol/L', min: 100, max: 180, placeholder: 'ex. 140' },
      { kind: 'number', id: 'chloride', label: 'Chlorémie', unit: 'mmol/L', min: 60, max: 140, placeholder: 'ex. 104' },
      { kind: 'number', id: 'bicarbonate', label: 'Bicarbonates (HCO₃⁻)', unit: 'mmol/L', min: 2, max: 45, placeholder: 'ex. 24' },
    ],
    reference: 'TA = Na − (Cl + HCO₃⁻). Normale 8–12 mmol/L (sans le potassium). Corriger de l’albumine (−0,25 × [40 − alb]).',
    compute: (v) => {
      const { sodium, chloride, bicarbonate } = v;
      if (![sodium, chloride, bicarbonate].every(Number.isFinite)) {
        return incompleteResult('Renseignez natrémie, chlorémie et bicarbonates.');
      }
      const ag = sodium - (chloride + bicarbonate);
      let interpretation: ScoreInterpretation;
      if (ag > 12) interpretation = { level: 'high', label: 'Trou anionique augmenté', detail: 'TA > 12 : acidose métabolique à TA élevé (acido-cétose, lactates, insuffisance rénale, toxiques).' };
      else if (ag < 8) interpretation = { level: 'info', label: 'Trou anionique bas', detail: 'TA < 8 : rare — hypoalbuminémie, paraprotéine, erreur de mesure.' };
      else interpretation = { level: 'low', label: 'Trou anionique normal', detail: 'TA 8–12 : si acidose, elle est à TA normal (hyperchlorémique : pertes digestives, ATR).' };
      return { value: ag, display: `${fmt(ag, 1)} mmol/L`, interpretation };
    },
  },

  {
    id: 'osmolalite',
    name: 'Osmolalité plasmatique calculée',
    acronym: 'Osm calculée',
    category: 'nephro',
    purpose:
      "Estime l'osmolalité plasmatique ; sa comparaison à l'osmolalité mesurée révèle un trou osmolaire (intoxications aux alcools).",
    aliases: ['osmolalite', 'osmolarite', 'osmolalité plasmatique', 'trou osmolaire'],
    keywords: ['osmolalité', 'osmolarité', 'trou osmolaire', 'intoxication', 'éthylène glycol', 'ionogramme', 'natrémie'],
    fields: [
      { kind: 'number', id: 'sodium', label: 'Natrémie', unit: 'mmol/L', min: 100, max: 180, placeholder: 'ex. 140' },
      { kind: 'number', id: 'glucose', label: 'Glycémie', unit: 'mmol/L', min: 2, max: 80, step: 0.1, placeholder: 'ex. 5' },
      { kind: 'number', id: 'urea', label: 'Urée', unit: 'mmol/L', min: 1, max: 60, step: 0.1, placeholder: 'ex. 5' },
    ],
    reference: 'Osm = 2 × Na + glycémie + urée (mmol/L). Normale 275–295 mOsm/kg.',
    compute: (v) => {
      const { sodium, glucose, urea } = v;
      if (![sodium, glucose, urea].every(Number.isFinite)) {
        return incompleteResult('Renseignez natrémie, glycémie et urée.');
      }
      const osm = 2 * sodium + glucose + urea;
      let interpretation: ScoreInterpretation;
      if (osm > 295) interpretation = { level: 'moderate', label: 'Hyperosmolalité', detail: 'Osmolalité > 295 : déshydratation, hyperglycémie, hypernatrémie.' };
      else if (osm < 275) interpretation = { level: 'moderate', label: 'Hypo-osmolalité', detail: 'Osmolalité < 275 : hyperhydratation, hyponatrémie hypotonique.' };
      else interpretation = { level: 'low', label: 'Normale', detail: 'Osmolalité calculée dans les normes (275–295). Comparer à l’osmolalité mesurée (trou osmolaire).' };
      return { value: osm, display: `${fmt(osm)} mOsm/kg`, interpretation };
    },
  },

  {
    id: 'fena',
    name: 'Fraction d’excrétion du sodium',
    acronym: 'FeNa',
    category: 'nephro',
    purpose:
      "Distingue une insuffisance rénale aiguë fonctionnelle (pré-rénale) d'une nécrose tubulaire aiguë (organique).",
    aliases: ['fena', 'fraction excretion sodium', 'excrétion sodium'],
    keywords: [
      'insuffisance rénale aiguë',
      'IRA',
      'fonctionnelle',
      'organique',
      'nécrose tubulaire',
      'sodium urinaire',
      'oligurie',
    ],
    fields: [
      { kind: 'number', id: 'uNa', label: 'Sodium urinaire', unit: 'mmol/L', min: 1, max: 300, placeholder: 'ex. 20' },
      { kind: 'number', id: 'pNa', label: 'Sodium plasmatique', unit: 'mmol/L', min: 100, max: 180, placeholder: 'ex. 140' },
      { kind: 'number', id: 'uCreat', label: 'Créatinine urinaire', unit: 'µmol/L', min: 100, max: 100000, placeholder: 'ex. 8000' },
      { kind: 'number', id: 'pCreat', label: 'Créatinine plasmatique', unit: 'µmol/L', min: 10, max: 2000, placeholder: 'ex. 180' },
    ],
    reference: 'FeNa = (UNa × PCréat) / (PNa × UCréat) × 100. Interprétation en IRA oligurique, hors diurétiques.',
    caution: 'Non interprétable sous diurétiques (préférer la FeUrée), ni en cas de produit de contraste récent.',
    compute: (v) => {
      const { uNa, pNa, uCreat, pCreat } = v;
      if (![uNa, pNa, uCreat, pCreat].every(Number.isFinite) || pNa <= 0 || uCreat <= 0) {
        return incompleteResult('Renseignez les 4 valeurs (Na et créatinine, urinaires et plasmatiques).');
      }
      const fena = ((uNa * pCreat) / (pNa * uCreat)) * 100;
      let interpretation: ScoreInterpretation;
      if (fena < 1) interpretation = { level: 'moderate', label: 'IRA fonctionnelle', detail: 'FeNa < 1 % : origine pré-rénale (fonctionnelle) — hypovolémie, bas débit. Restaurer la volémie.' };
      else if (fena > 2) interpretation = { level: 'high', label: 'IRA organique', detail: 'FeNa > 2 % : origine rénale (nécrose tubulaire aiguë).' };
      else interpretation = { level: 'info', label: 'Zone intermédiaire', detail: 'FeNa 1–2 % : indéterminé — recouper avec la clinique et la FeUrée.' };
      return { value: fena, display: `${fmt(fena, 1)} %`, interpretation };
    },
  },
];
