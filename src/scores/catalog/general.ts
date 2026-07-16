/**
 * Scores GÉNÉRAUX / transversaux.
 * Corpulence (IMC), surface corporelle (Mosteller), repérage de la consommation
 * d'alcool (AUDIT-C, CAGE).
 */
import { additiveScore, fmt, yesNo, type ScoreDefinition, type ScoreInterpretation } from '../types';

const incompleteResult = (msg: string): ReturnType<ScoreDefinition['compute']> => ({
  value: NaN,
  display: '—',
  incomplete: true,
  interpretation: { level: 'info', label: 'Champs à compléter', detail: msg },
});

export const GENERAL_SCORES: ScoreDefinition[] = [
  {
    id: 'imc',
    name: 'Indice de masse corporelle',
    acronym: 'IMC',
    category: 'general',
    purpose:
      "Rapporte le poids à la taille pour situer la corpulence (maigreur, surpoids, obésité) chez l'adulte.",
    aliases: ['imc', 'bmi', 'indice masse corporelle', 'body mass index', 'corpulence'],
    keywords: ['poids', 'obésité', 'surpoids', 'maigreur', 'nutrition', 'corpulence', 'dénutrition'],
    fields: [
      { kind: 'number', id: 'weight', label: 'Poids', unit: 'kg', min: 20, max: 300, step: 0.1, placeholder: 'ex. 70' },
      { kind: 'number', id: 'height', label: 'Taille', unit: 'cm', min: 100, max: 230, placeholder: 'ex. 175' },
    ],
    reference: 'OMS. Normale 18,5–24,9 kg/m² (adulte, hors grossesse, sportif de haut niveau).',
    compute: (v) => {
      const { weight, height } = v;
      if (!Number.isFinite(weight) || !Number.isFinite(height) || height <= 0) {
        return incompleteResult('Renseignez le poids et la taille.');
      }
      const m = height / 100;
      const bmi = weight / (m * m);
      let interpretation: ScoreInterpretation;
      if (bmi < 18.5) interpretation = { level: 'moderate', label: 'Insuffisance pondérale', detail: 'IMC < 18,5 : maigreur — rechercher une dénutrition.' };
      else if (bmi < 25) interpretation = { level: 'low', label: 'Corpulence normale', detail: 'IMC 18,5–24,9 : corpulence normale.' };
      else if (bmi < 30) interpretation = { level: 'moderate', label: 'Surpoids', detail: 'IMC 25–29,9 : surpoids.' };
      else if (bmi < 35) interpretation = { level: 'high', label: 'Obésité classe I', detail: 'IMC 30–34,9 : obésité modérée.' };
      else if (bmi < 40) interpretation = { level: 'high', label: 'Obésité classe II', detail: 'IMC 35–39,9 : obésité sévère.' };
      else interpretation = { level: 'critical', label: 'Obésité classe III', detail: 'IMC ≥ 40 : obésité morbide.' };
      return { value: bmi, display: `${fmt(bmi, 1)} kg/m²`, interpretation };
    },
  },

  {
    id: 'surface-corporelle',
    name: 'Surface corporelle (Mosteller)',
    acronym: 'SC / BSA',
    category: 'general',
    purpose:
      "Estime la surface corporelle, utilisée pour l'adaptation de posologies (chimiothérapie, index cardiaque…).",
    aliases: ['surface corporelle', 'bsa', 'mosteller', 'body surface area'],
    keywords: ['surface corporelle', 'posologie', 'chimiothérapie', 'index cardiaque', 'dose'],
    fields: [
      { kind: 'number', id: 'weight', label: 'Poids', unit: 'kg', min: 3, max: 300, step: 0.1, placeholder: 'ex. 70' },
      { kind: 'number', id: 'height', label: 'Taille', unit: 'cm', min: 40, max: 230, placeholder: 'ex. 175' },
    ],
    reference: 'Mosteller 1987. SC = √(taille[cm] × poids[kg] / 3600). Adulte ≈ 1,6–2,0 m².',
    compute: (v) => {
      const { weight, height } = v;
      if (!Number.isFinite(weight) || !Number.isFinite(height) || weight <= 0 || height <= 0) {
        return incompleteResult('Renseignez le poids et la taille.');
      }
      const bsa = Math.sqrt((height * weight) / 3600);
      return {
        value: bsa,
        display: `${fmt(bsa, 2)} m²`,
        interpretation: { level: 'info', label: 'Surface corporelle', detail: 'Valeur indicative pour l’adaptation posologique (adulte ≈ 1,6–2,0 m²).' },
      };
    },
  },

  {
    id: 'ganzoni',
    name: 'Déficit en fer (formule de Ganzoni)',
    acronym: 'Ganzoni',
    category: 'general',
    purpose:
      "Estime le déficit TOTAL en fer d'un patient (mg) à recharger, pour calculer la dose d'une supplémentation martiale (souvent par voie intraveineuse).",
    aliases: ['ganzoni', 'deficit en fer', 'déficit martial', 'dose de fer', 'carence martiale', 'iron deficit'],
    keywords: [
      'fer',
      'carence en fer',
      'anémie',
      'anémie ferriprive',
      'déficit martial',
      'supplémentation en fer',
      'fer injectable',
      'fer intraveineux',
      'besoin en fer',
      'hémoglobine',
    ],
    fields: [
      { kind: 'number', id: 'weight', label: 'Poids', unit: 'kg', min: 3, max: 250, step: 0.1, placeholder: 'ex. 70' },
      { kind: 'number', id: 'hbActual', label: 'Hémoglobine actuelle', unit: 'g/dL', min: 3, max: 20, step: 0.1, placeholder: 'ex. 9' },
      { kind: 'number', id: 'hbTarget', label: 'Hémoglobine cible', unit: 'g/dL', min: 10, max: 18, step: 0.1, default: 15, placeholder: '15' },
    ],
    reference:
      'Ganzoni 1970. Déficit (mg) = poids × (Hb cible − Hb actuelle) × 2,4 + réserves (500 mg si ≥ 35 kg, sinon 15 mg/kg).',
    caution:
      'Hémoglobine à saisir en g/dL. Estimation pour le calcul de dose (ferrothérapie IV) : vérifier bilan martial, cause du déficit et protocole du produit.',
    compute: (v) => {
      const { weight, hbActual, hbTarget } = v;
      if (![weight, hbActual, hbTarget].every(Number.isFinite) || weight <= 0) {
        return incompleteResult('Renseignez le poids, l’Hb actuelle et l’Hb cible.');
      }
      const depot = weight >= 35 ? 500 : 15 * weight;
      const deltaHb = Math.max(0, hbTarget - hbActual);
      const deficit = weight * deltaHb * 2.4 + depot;
      const interpretation: ScoreInterpretation =
        deltaHb === 0
          ? { level: 'info', label: 'Réserves seulement', detail: `Hb déjà ≥ cible : seule la reconstitution des réserves est estimée (${fmt(depot)} mg).` }
          : { level: 'info', label: 'Déficit en fer estimé', detail: `Déficit total ≈ ${fmt(deficit)} mg de fer à recharger (dont ${fmt(depot)} mg de réserves). Adapter à la ferrothérapie choisie (souvent IV).` };
      return { value: deficit, display: `${fmt(deficit)} mg`, interpretation };
    },
  },

  {
    id: 'audit-c',
    name: 'AUDIT-C (repérage de la consommation d’alcool)',
    acronym: 'AUDIT-C',
    category: 'general',
    purpose:
      "Dépiste rapidement une consommation d'alcool à risque (3 questions). Seuil : homme ≥ 4, femme ≥ 3.",
    aliases: ['audit c', 'audit-c', 'auditc', 'alcool dépistage'],
    keywords: ['alcool', 'addiction', 'consommation', 'dépistage', 'mésusage', 'dépendance'],
    fields: [
      {
        kind: 'choice',
        id: 'sex',
        label: 'Sexe (seuil de positivité)',
        options: [
          { label: 'Homme (≥ 4)', value: 0 },
          { label: 'Femme (≥ 3)', value: 1 },
        ],
      },
      {
        kind: 'choice',
        id: 'q1',
        label: 'Fréquence de consommation d’alcool',
        options: [
          { label: 'Jamais', value: 0 },
          { label: '1×/mois ou moins', value: 1 },
          { label: '2–4×/mois', value: 2 },
          { label: '2–3×/semaine', value: 3 },
          { label: '≥ 4×/semaine', value: 4 },
        ],
      },
      {
        kind: 'choice',
        id: 'q2',
        label: 'Nombre de verres un jour de consommation',
        options: [
          { label: '1–2', value: 0 },
          { label: '3–4', value: 1 },
          { label: '5–6', value: 2 },
          { label: '7–9', value: 3 },
          { label: '≥ 10', value: 4 },
        ],
      },
      {
        kind: 'choice',
        id: 'q3',
        label: 'Fréquence de ≥ 6 verres en une occasion',
        options: [
          { label: 'Jamais', value: 0 },
          { label: '< 1×/mois', value: 1 },
          { label: '1×/mois', value: 2 },
          { label: '1×/semaine', value: 3 },
          { label: 'Chaque jour ou presque', value: 4 },
        ],
      },
    ],
    reference: 'Bush 1998. Score 0–12. Seuil : homme ≥ 4, femme ≥ 3.',
    compute: (v) => {
      const total = (v.q1 ?? 0) + (v.q2 ?? 0) + (v.q3 ?? 0);
      const threshold = v.sex === 1 ? 3 : 4;
      let interpretation: ScoreInterpretation;
      if (total >= 8) interpretation = { level: 'high', label: 'Consommation à risque élevé', detail: 'Score ≥ 8 : consommation à risque élevé — évaluer une dépendance (AUDIT complet).' };
      else if (total >= threshold) interpretation = { level: 'moderate', label: 'Dépistage positif', detail: `Score ≥ ${threshold} : consommation à risque — proposer une évaluation et un accompagnement.` };
      else interpretation = { level: 'low', label: 'Dépistage négatif', detail: 'Consommation à faible risque selon l’AUDIT-C.' };
      return { value: total, display: `${fmt(total)} / 12`, interpretation };
    },
  },

  additiveScore(
    {
      id: 'cage',
      name: 'Questionnaire CAGE (alcool)',
      acronym: 'CAGE',
      category: 'general',
      purpose:
        "Repérage rapide (4 questions) d'une consommation d'alcool problématique / dépendance.",
      aliases: ['cage', 'cage alcool', 'deta'],
      keywords: ['alcool', 'addiction', 'dépendance', 'dépistage', 'mésusage'],
      fields: [
        yesNo('cut', 'A déjà ressenti le besoin de réduire (Cut down) sa consommation', 1),
        yesNo('annoyed', 'Agacé(e) par les critiques sur sa consommation (Annoyed)', 1),
        yesNo('guilty', 'Culpabilité liée à la consommation (Guilty)', 1),
        yesNo('eyeOpener', 'Boire dès le matin pour tenir / se calmer (Eye-opener)', 1),
      ],
      reference: 'Ewing 1984. Seuil de positivité : ≥ 2.',
    },
    [
      { min: 0, level: 'low', label: 'Dépistage négatif', detail: 'Score 0–1 : dépistage négatif.' },
      { min: 2, level: 'high', label: 'Dépistage positif', detail: 'Score ≥ 2 : forte suspicion de consommation problématique — approfondir (AUDIT, entretien).' },
    ],
  ),

  additiveScore(
    {
      id: 'fagerstrom',
      name: 'Test de Fagerström (dépendance à la nicotine)',
      acronym: 'Fagerström',
      category: 'general',
      purpose:
        "Évalue l'intensité de la dépendance physique à la nicotine pour adapter l'aide au sevrage.",
      aliases: ['fagerstrom', 'ftnd', 'dependance nicotine', 'tabac dependance'],
      keywords: ['tabac', 'nicotine', 'dépendance', 'sevrage', 'addiction', 'cigarette', 'substituts'],
      fields: [
        {
          kind: 'choice',
          id: 'delay',
          label: 'Délai entre le réveil et la 1re cigarette',
          options: [
            { label: '> 60 min', value: 0 },
            { label: '31–60 min', value: 1 },
            { label: '6–30 min', value: 2 },
            { label: '≤ 5 min', value: 3 },
          ],
        },
        {
          kind: 'choice',
          id: 'forbidden',
          label: 'Difficile de s’abstenir dans les lieux interdits',
          options: [
            { label: 'Non', value: 0 },
            { label: 'Oui', value: 1 },
          ],
        },
        {
          kind: 'choice',
          id: 'giveUp',
          label: 'Cigarette la plus difficile à abandonner',
          options: [
            { label: 'N’importe quelle autre', value: 0 },
            { label: 'La première du matin', value: 1 },
          ],
        },
        {
          kind: 'choice',
          id: 'number',
          label: 'Nombre de cigarettes par jour',
          options: [
            { label: '≤ 10', value: 0 },
            { label: '11–20', value: 1 },
            { label: '21–30', value: 2 },
            { label: '≥ 31', value: 3 },
          ],
        },
        {
          kind: 'choice',
          id: 'morning',
          label: 'Fume davantage le matin',
          options: [
            { label: 'Non', value: 0 },
            { label: 'Oui', value: 1 },
          ],
        },
        {
          kind: 'choice',
          id: 'sick',
          label: 'Fume même alité(e), malade',
          options: [
            { label: 'Non', value: 0 },
            { label: 'Oui', value: 1 },
          ],
        },
      ],
      reference: 'Heatherton 1991 (FTND). Score 0–10.',
    },
    [
      { min: 0, level: 'low', label: 'Dépendance faible', detail: 'Score 0–2 : dépendance faible ou absente.' },
      { min: 3, level: 'moderate', label: 'Dépendance modérée', detail: 'Score 3–4 : dépendance modérée.' },
      { min: 5, level: 'high', label: 'Dépendance forte', detail: 'Score 5–10 : dépendance forte à très forte — substituts nicotiniques / aide au sevrage recommandés.' },
    ],
  ),
];
