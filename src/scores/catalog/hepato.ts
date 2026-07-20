/**
 * Scores HÉPATO-GASTRO-ENTÉROLOGIE.
 * Gravité de la cirrhose (Child-Pugh, MELD), hémorragie digestive (Blatchford),
 * fibrose hépatique (FIB-4, APRI), hépatite alcoolique (Maddrey).
 *
 * ⚠️ Bilirubine et créatinine saisies en µmol/L (usage FR), converties dans les
 * formules (bili ÷ 17,1 ; créat ÷ 88,4). Formules couvertes par des tests.
 */
import { additiveScore, fmt, yesNo, type ScoreDefinition, type ScoreInterpretation } from '../types';

const UMOL_TO_MGDL_BILI = 1 / 17.1;
const UMOL_TO_MGDL_CREAT = 1 / 88.4;

const incompleteResult = (msg: string): ReturnType<ScoreDefinition['compute']> => ({
  value: NaN,
  display: '—',
  incomplete: true,
  interpretation: { level: 'info', label: 'Champs à compléter', detail: msg },
});

/** Interprétation MELD partagée (mortalité à 3 mois). */
function meldInterpretation(meld: number): ScoreInterpretation {
  if (meld < 10) return { level: 'low', label: 'Faible', detail: 'MELD < 10 : mortalité à 3 mois ≈ 2 %.' };
  if (meld < 20) return { level: 'moderate', label: 'Intermédiaire', detail: 'MELD 10–19 : mortalité à 3 mois ≈ 6 %.' };
  if (meld < 30) return { level: 'high', label: 'Élevé', detail: 'MELD 20–29 : mortalité à 3 mois ≈ 20 % — avis transplantation.' };
  return { level: 'critical', label: 'Très élevé', detail: 'MELD ≥ 30 : mortalité à 3 mois ≥ 50 %.' };
}

/** MELD original (entier borné 6–40) à partir des valeurs FR. NaN si incomplet. */
function computeMeld(v: Record<string, number>): number {
  const biliMg = v.bilirubin * UMOL_TO_MGDL_BILI;
  const inr = v.inr;
  const dialysis = v.dialysis === 1;
  const creatMg = dialysis ? 4.0 : v.creat * UMOL_TO_MGDL_CREAT;
  if (![biliMg, inr, creatMg].every(Number.isFinite)) return NaN;
  const bili = Math.max(biliMg, 1);
  const inrC = Math.max(inr, 1);
  const creat = Math.min(Math.max(creatMg, 1), 4);
  const meld = 3.78 * Math.log(bili) + 11.2 * Math.log(inrC) + 9.57 * Math.log(creat) + 6.43;
  return Math.min(40, Math.max(6, Math.round(meld)));
}

const MELD_FIELDS: ScoreDefinition['fields'] = [
  { kind: 'number', id: 'bilirubin', label: 'Bilirubine totale', unit: 'µmol/L', min: 2, max: 900, placeholder: 'ex. 40' },
  { kind: 'number', id: 'inr', label: 'INR', min: 0.8, max: 10, step: 0.1, placeholder: 'ex. 1,4' },
  { kind: 'number', id: 'creat', label: 'Créatininémie', unit: 'µmol/L', min: 10, max: 2000, placeholder: 'ex. 90' },
  {
    kind: 'choice',
    id: 'dialysis',
    label: 'Dialyse ≥ 2×/semaine',
    options: [
      { label: 'Non', value: 0 },
      { label: 'Oui', value: 1 },
    ],
  },
];

export const HEPATO_SCORES: ScoreDefinition[] = [
  additiveScore(
    {
      id: 'child-pugh',
      name: 'Score de Child-Pugh',
      acronym: 'Child-Pugh',
      category: 'hepato',
      purpose:
        "Évalue la gravité d'une cirrhose (classes A/B/C) : pronostic, opérabilité et adaptation de certains traitements.",
      aliases: ['child pugh', 'child', 'child-pugh-turcotte', 'cirrhose score'],
      keywords: [
        'cirrhose',
        'insuffisance hépatique',
        'pronostic',
        'foie',
        'ascite',
        'encéphalopathie',
        'gravité hépatique',
      ],
      fields: [
        {
          kind: 'choice',
          id: 'bilirubin',
          label: 'Bilirubine totale',
          options: [
            { label: '< 34 µmol/L', value: 1 },
            { label: '34–50 µmol/L', value: 2 },
            { label: '> 50 µmol/L', value: 3 },
          ],
        },
        {
          kind: 'choice',
          id: 'albumin',
          label: 'Albuminémie',
          options: [
            { label: '> 35 g/L', value: 1 },
            { label: '28–35 g/L', value: 2 },
            { label: '< 28 g/L', value: 3 },
          ],
        },
        {
          kind: 'choice',
          id: 'inr',
          label: 'INR (ou TP)',
          options: [
            { label: '< 1,7 (TP > 50 %)', value: 1 },
            { label: '1,7–2,3 (TP 40–50 %)', value: 2 },
            { label: '> 2,3 (TP < 40 %)', value: 3 },
          ],
        },
        {
          kind: 'choice',
          id: 'ascites',
          label: 'Ascite',
          options: [
            { label: 'Absente', value: 1 },
            { label: 'Minime / contrôlée', value: 2 },
            { label: 'Modérée à tendue', value: 3 },
          ],
        },
        {
          kind: 'choice',
          id: 'encephalopathy',
          label: 'Encéphalopathie',
          options: [
            { label: 'Absente', value: 1 },
            { label: 'Grade 1–2', value: 2 },
            { label: 'Grade 3–4', value: 3 },
          ],
        },
      ],
      reference: 'Pugh 1973. A = 5–6, B = 7–9, C = 10–15.',
    },
    [
      { min: 5, level: 'low', label: 'Classe A', detail: 'Score 5–6 : cirrhose compensée — survie à 1 an ≈ 100 %.' },
      { min: 7, level: 'moderate', label: 'Classe B', detail: 'Score 7–9 : atteinte fonctionnelle significative — survie à 1 an ≈ 80 %.' },
      { min: 10, level: 'high', label: 'Classe C', detail: 'Score 10–15 : cirrhose décompensée — survie à 1 an ≈ 45 %, avis transplantation.' },
    ],
  ),

  {
    id: 'meld',
    name: 'Model for End-stage Liver Disease',
    acronym: 'MELD',
    category: 'hepato',
    purpose:
      "Estime la mortalité à court terme d'une hépatopathie chronique et hiérarchise l'accès à la transplantation hépatique.",
    aliases: ['meld', 'model end stage liver disease'],
    keywords: ['cirrhose', 'transplantation hépatique', 'greffe foie', 'insuffisance hépatique', 'pronostic', 'mortalité'],
    fields: MELD_FIELDS,
    reference: 'Kamath 2001. Valeurs bornées (min 1 ; créat max 4 ; dialyse → créat = 4). Résultat 6–40.',
    compute: (v) => {
      const meld = computeMeld(v);
      if (!Number.isFinite(meld)) return incompleteResult('Renseignez bilirubine, INR et créatininémie.');
      return { value: meld, display: `${fmt(meld)} points`, interpretation: meldInterpretation(meld) };
    },
  },

  {
    id: 'meld-na',
    name: 'MELD-Na (MELD corrigé par la natrémie)',
    acronym: 'MELD-Na',
    category: 'hepato',
    purpose:
      "Affine le MELD en intégrant la natrémie : l'hyponatrémie aggrave le pronostic de la cirrhose.",
    aliases: ['meld na', 'meldna', 'meld sodium'],
    keywords: ['cirrhose', 'transplantation hépatique', 'natrémie', 'hyponatrémie', 'pronostic', 'mortalité', 'greffe foie'],
    fields: [
      ...MELD_FIELDS,
      { kind: 'number', id: 'sodium', label: 'Natrémie', unit: 'mmol/L', min: 110, max: 160, placeholder: 'ex. 132' },
    ],
    reference: 'Kim 2008 (UNOS). Correction appliquée si MELD > 11 ; natrémie bornée 125–137.',
    compute: (v) => {
      const meld = computeMeld(v);
      const na = v.sodium;
      if (!Number.isFinite(meld) || !Number.isFinite(na)) {
        return incompleteResult('Renseignez bilirubine, INR, créatininémie et natrémie.');
      }
      let result = meld;
      if (meld > 11) {
        const naB = Math.min(137, Math.max(125, na));
        result = meld + 1.32 * (137 - naB) - 0.033 * meld * (137 - naB);
        result = Math.min(40, Math.max(6, Math.round(result)));
      }
      return { value: result, display: `${fmt(result)} points`, interpretation: meldInterpretation(result) };
    },
  },

  {
    id: 'blatchford',
    name: 'Score de Glasgow-Blatchford',
    acronym: 'GBS',
    category: 'hepato',
    purpose:
      "Évalue, avant endoscopie, le risque qu'une hémorragie digestive haute nécessite un geste (transfusion, hémostase) ; un score de 0 autorise une prise en charge ambulatoire.",
    aliases: ['blatchford', 'glasgow blatchford', 'gbs', 'hemorragie digestive score'],
    keywords: [
      'hémorragie digestive',
      'hématémèse',
      'méléna',
      'ulcère',
      'endoscopie',
      'transfusion',
      'gastro',
      'saignement digestif',
    ],
    fields: [
      {
        kind: 'choice',
        id: 'sex',
        label: 'Sexe (seuils d’hémoglobine)',
        options: [
          { label: 'Homme', value: 0 },
          { label: 'Femme', value: 1 },
        ],
      },
      { kind: 'number', id: 'urea', label: 'Urée sanguine', unit: 'mmol/L', min: 1, max: 60, step: 0.1, placeholder: 'ex. 9' },
      { kind: 'number', id: 'hb', label: 'Hémoglobine', unit: 'g/L', min: 30, max: 200, placeholder: 'ex. 115' },
      { kind: 'number', id: 'sbp', label: 'PA systolique', unit: 'mmHg', min: 50, max: 250, placeholder: 'ex. 105' },
      {
        kind: 'choice',
        id: 'pulse',
        label: 'Pouls ≥ 100/min',
        options: [
          { label: 'Non', value: 0 },
          { label: 'Oui', value: 1 },
        ],
      },
      {
        kind: 'choice',
        id: 'melena',
        label: 'Méléna',
        options: [
          { label: 'Non', value: 0 },
          { label: 'Oui', value: 1 },
        ],
      },
      {
        kind: 'choice',
        id: 'syncope',
        label: 'Syncope',
        options: [
          { label: 'Non', value: 0 },
          { label: 'Oui', value: 2 },
        ],
      },
      {
        kind: 'choice',
        id: 'hepatic',
        label: 'Hépatopathie connue',
        options: [
          { label: 'Non', value: 0 },
          { label: 'Oui', value: 2 },
        ],
      },
      {
        kind: 'choice',
        id: 'cardiac',
        label: 'Insuffisance cardiaque',
        options: [
          { label: 'Non', value: 0 },
          { label: 'Oui', value: 2 },
        ],
      },
    ],
    reference: 'Blatchford 2000. Score 0 = très faible risque (ambulatoire envisageable).',
    compute: (v) => {
      const { urea, hb, sbp } = v;
      if (![urea, hb, sbp].every(Number.isFinite)) {
        return incompleteResult('Renseignez urée, hémoglobine et PA systolique.');
      }
      let s = 0;
      // Urée (mmol/L)
      if (urea >= 25) s += 6;
      else if (urea >= 10) s += 4;
      else if (urea >= 8) s += 3;
      else if (urea >= 6.5) s += 2;
      // Hémoglobine (g/L) — seuils selon le sexe
      const female = v.sex === 1;
      if (hb < 100) s += 6;
      else if (hb < 120) s += female ? 1 : 3;
      else if (!female && hb < 130) s += 1;
      // PA systolique
      if (sbp < 90) s += 3;
      else if (sbp < 100) s += 2;
      else if (sbp < 110) s += 1;
      // Facteurs binaires
      s += v.pulse + v.melena + v.syncope + v.hepatic + v.cardiac;

      let interpretation: ScoreInterpretation;
      if (s === 0) interpretation = { level: 'low', label: 'Très faible risque', detail: 'Score 0 : geste très peu probable — prise en charge ambulatoire envisageable.' };
      else if (s < 6) interpretation = { level: 'moderate', label: 'Risque intermédiaire', detail: 'Score 1–5 : hospitalisation et endoscopie recommandées.' };
      else interpretation = { level: 'high', label: 'Risque élevé', detail: 'Score ≥ 6 : risque élevé de transfusion / geste hémostatique — endoscopie rapide.' };
      return { value: s, display: `${fmt(s)} points`, interpretation };
    },
  },

  {
    id: 'fib-4',
    name: 'Index FIB-4 (fibrose hépatique)',
    acronym: 'FIB-4',
    category: 'hepato',
    purpose:
      "Estime, de façon non invasive, la probabilité de fibrose hépatique avancée (à partir de l'âge, des transaminases et des plaquettes).",
    aliases: ['fib4', 'fib-4', 'fibrose 4', 'index fibrose'],
    keywords: ['fibrose', 'foie', 'stéatose', 'NASH', 'hépatite chronique', 'transaminases', 'cirrhose', 'plaquettes'],
    fields: [
      { kind: 'number', id: 'age', label: 'Âge', unit: 'ans', min: 18, max: 100, placeholder: 'ex. 55' },
      { kind: 'number', id: 'ast', label: 'ASAT (AST)', unit: 'UI/L', min: 5, max: 2000, placeholder: 'ex. 45' },
      { kind: 'number', id: 'alt', label: 'ALAT (ALT)', unit: 'UI/L', min: 5, max: 2000, placeholder: 'ex. 30' },
      { kind: 'number', id: 'platelets', label: 'Plaquettes', unit: '10⁹/L', min: 10, max: 900, placeholder: 'ex. 180' },
    ],
    reference: 'Sterling 2006. < 1,45 exclut, > 3,25 évoque une fibrose avancée.',
    compute: (v) => {
      const { age, ast, alt, platelets } = v;
      if (![age, ast, alt, platelets].every(Number.isFinite) || platelets <= 0 || alt <= 0) {
        return incompleteResult('Renseignez âge, ASAT, ALAT et plaquettes.');
      }
      const fib4 = (age * ast) / (platelets * Math.sqrt(alt));
      let interpretation: ScoreInterpretation;
      if (fib4 < 1.45) interpretation = { level: 'low', label: 'Fibrose avancée improbable', detail: 'FIB-4 < 1,45 : fibrose avancée peu probable (excellente valeur prédictive négative).' };
      else if (fib4 <= 3.25) interpretation = { level: 'moderate', label: 'Zone indéterminée', detail: 'FIB-4 1,45–3,25 : indéterminé — évaluation complémentaire (élastométrie).' };
      else interpretation = { level: 'high', label: 'Fibrose avancée probable', detail: 'FIB-4 > 3,25 : fibrose avancée probable — avis hépatologique.' };
      return { value: fib4, display: fmt(fib4, 2), interpretation };
    },
  },

  {
    id: 'apri',
    name: 'APRI (ratio ASAT/plaquettes)',
    acronym: 'APRI',
    category: 'hepato',
    purpose:
      "Marqueur non invasif simple de fibrose hépatique significative / cirrhose (utile là où l'élastométrie n'est pas disponible).",
    aliases: ['apri', 'ast platelet ratio', 'ratio asat plaquettes'],
    keywords: ['fibrose', 'cirrhose', 'foie', 'hépatite', 'transaminases', 'plaquettes', 'ASAT'],
    fields: [
      { kind: 'number', id: 'ast', label: 'ASAT (AST)', unit: 'UI/L', min: 5, max: 2000, placeholder: 'ex. 60' },
      { kind: 'number', id: 'astUln', label: 'Limite supérieure normale ASAT', unit: 'UI/L', min: 10, max: 60, default: 40, placeholder: '40' },
      { kind: 'number', id: 'platelets', label: 'Plaquettes', unit: '10⁹/L', min: 10, max: 900, placeholder: 'ex. 150' },
    ],
    reference: 'Wai 2003. < 0,5 exclut la fibrose significative ; > 1,5 l’évoque (> 2 : cirrhose).',
    compute: (v) => {
      const { ast, astUln, platelets } = v;
      if (![ast, astUln, platelets].every(Number.isFinite) || platelets <= 0 || astUln <= 0) {
        return incompleteResult('Renseignez ASAT, sa limite normale et les plaquettes.');
      }
      const apri = ((ast / astUln) * 100) / platelets;
      let interpretation: ScoreInterpretation;
      if (apri < 0.5) interpretation = { level: 'low', label: 'Fibrose significative improbable', detail: 'APRI < 0,5 : fibrose significative peu probable.' };
      else if (apri <= 1.5) interpretation = { level: 'moderate', label: 'Zone indéterminée', detail: 'APRI 0,5–1,5 : indéterminé — évaluation complémentaire.' };
      else interpretation = { level: 'high', label: 'Fibrose significative probable', detail: 'APRI > 1,5 : fibrose significative probable (> 2 : cirrhose).' };
      return { value: apri, display: fmt(apri, 2), interpretation };
    },
  },

  {
    id: 'maddrey',
    name: 'Fonction discriminante de Maddrey',
    acronym: 'Maddrey (DF)',
    category: 'hepato',
    purpose:
      "Évalue la gravité d'une hépatite alcoolique aiguë et l'indication d'une corticothérapie (seuil ≥ 32).",
    aliases: ['maddrey', 'fonction discriminante', 'discriminant function', 'hepatite alcoolique'],
    keywords: ['hépatite alcoolique', 'alcool', 'foie', 'corticoïdes', 'TP', 'bilirubine', 'gravité hépatique'],
    fields: [
      { kind: 'number', id: 'ptPatient', label: 'TP / temps de Quick (patient)', unit: 'sec', min: 8, max: 60, step: 0.1, placeholder: 'ex. 20' },
      { kind: 'number', id: 'ptControl', label: 'Témoin', unit: 'sec', min: 8, max: 16, step: 0.1, default: 12, placeholder: '12' },
      { kind: 'number', id: 'bilirubin', label: 'Bilirubine totale', unit: 'µmol/L', min: 5, max: 900, placeholder: 'ex. 150' },
    ],
    reference: 'Maddrey 1978. DF = 4,6 × (TP − témoin) + bilirubine(mg/dL). Seuil de gravité : ≥ 32.',
    compute: (v) => {
      const { ptPatient, ptControl, bilirubin } = v;
      if (![ptPatient, ptControl, bilirubin].every(Number.isFinite)) {
        return incompleteResult('Renseignez le TP du patient, le témoin et la bilirubine.');
      }
      const df = 4.6 * (ptPatient - ptControl) + bilirubin * UMOL_TO_MGDL_BILI;
      let interpretation: ScoreInterpretation;
      if (df >= 32) interpretation = { level: 'high', label: 'Hépatite alcoolique sévère', detail: 'DF ≥ 32 : forme sévère (mortalité à court terme élevée) — corticothérapie à discuter.' };
      else interpretation = { level: 'low', label: 'Forme non sévère', detail: 'DF < 32 : hépatite alcoolique non sévère.' };
      return { value: df, display: fmt(df, 1), interpretation };
    },
  },

  additiveScore(
    {
      id: 'rockall',
      name: 'Score de Rockall (hémorragie digestive haute)',
      acronym: 'Rockall',
      category: 'hepato',
      purpose:
        "Évalue le risque de récidive hémorragique et de mortalité après une hémorragie digestive haute (score complet, post-endoscopie).",
      aliases: ['rockall', 'hemorragie digestive rockall'],
      keywords: ['hémorragie digestive', 'ulcère', 'endoscopie', 'récidive', 'mortalité', 'méléna', 'gastro'],
      fields: [
        {
          kind: 'choice',
          id: 'age',
          label: 'Âge',
          options: [
            { label: '< 60 ans', value: 0 },
            { label: '60–79 ans', value: 1 },
            { label: '≥ 80 ans', value: 2 },
          ],
        },
        {
          kind: 'choice',
          id: 'shock',
          label: 'État hémodynamique',
          options: [
            { label: 'Pas de choc (PAS ≥ 100, FC < 100)', value: 0 },
            { label: 'Tachycardie (FC ≥ 100, PAS ≥ 100)', value: 1 },
            { label: 'Hypotension (PAS < 100)', value: 2 },
          ],
        },
        {
          kind: 'choice',
          id: 'comorbidity',
          label: 'Comorbidités',
          options: [
            { label: 'Aucune majeure', value: 0 },
            { label: 'Insuffisance cardiaque, cardiopathie ischémique', value: 2 },
            { label: 'Insuffisance rénale/hépatique, cancer métastatique', value: 3 },
          ],
        },
        {
          kind: 'choice',
          id: 'diagnosis',
          label: 'Diagnostic endoscopique',
          options: [
            { label: 'Mallory-Weiss ou pas de lésion', value: 0 },
            { label: 'Autres diagnostics', value: 1 },
            { label: 'Cancer digestif haut', value: 2 },
          ],
        },
        {
          kind: 'choice',
          id: 'stigmata',
          label: 'Stigmates d’hémorragie récente',
          options: [
            { label: 'Aucun ou tache pigmentée', value: 0 },
            { label: 'Sang, caillot adhérent, vaisseau visible', value: 2 },
          ],
        },
      ],
      reference: 'Rockall 1996. Score 0–11.',
    },
    [
      { min: 0, level: 'low', label: 'Risque faible', detail: 'Score < 3 : faible risque de récidive et de mortalité.' },
      { min: 3, level: 'moderate', label: 'Risque intermédiaire', detail: 'Score 3–4 : risque intermédiaire.' },
      { min: 5, level: 'high', label: 'Risque élevé', detail: 'Score ≥ 5 : risque élevé de récidive / mortalité — surveillance rapprochée.' },
    ],
  ),

  additiveScore(
    {
      id: 'alvarado',
      name: 'Score d’Alvarado (appendicite aiguë)',
      acronym: 'Alvarado',
      category: 'hepato',
      purpose:
        "Estime la probabilité d'une appendicite aiguë devant une douleur de la fosse iliaque droite.",
      aliases: ['alvarado', 'mantrels', 'appendicite score'],
      keywords: ['appendicite', 'fosse iliaque droite', 'douleur abdominale', 'urgences', 'chirurgie', 'gastro'],
      fields: [
        yesNo('migration', 'Migration de la douleur en fosse iliaque droite', 1),
        yesNo('anorexia', 'Anorexie', 1),
        yesNo('nausea', 'Nausées / vomissements', 1),
        yesNo('tenderness', 'Sensibilité de la fosse iliaque droite', 2),
        yesNo('rebound', 'Douleur à la décompression (rebond)', 1),
        yesNo('fever', 'Température ≥ 37,3 °C', 1),
        yesNo('leukocytosis', 'Hyperleucocytose (> 10 000/mm³)', 2),
        yesNo('shift', 'Polynucléose neutrophile (> 75 %)', 1),
      ],
      reference: 'Alvarado 1986 (MANTRELS). Score 0–10.',
    },
    [
      { min: 0, level: 'low', label: 'Peu probable', detail: 'Score 1–4 : appendicite peu probable.' },
      { min: 5, level: 'moderate', label: 'Possible', detail: 'Score 5–6 : appendicite possible — surveillance / imagerie.' },
      { min: 7, level: 'high', label: 'Probable', detail: 'Score 7–10 : appendicite probable — avis chirurgical.' },
    ],
  ),
];
