/**
 * Scores CARDIOLOGIE / RYTHME.
 * Critères figés + testés (tests/unit/scores.test.ts). Aide à la décision, pas un diagnostic.
 */
import { additiveScore, fmt, yesNo, type ScoreDefinition, type ScoreInterpretation } from '../types';

const CARDIO_ROMAN = ['I', 'II', 'III', 'IV'];

export const CARDIO_SCORES: ScoreDefinition[] = [
  additiveScore(
    {
      id: 'cha2ds2-vasc',
      name: 'Score de risque thrombo-embolique dans la fibrillation atriale',
      acronym: 'CHA₂DS₂-VASc',
      category: 'cardio',
      purpose:
        "Estime le risque annuel d'AVC / embolie systémique dans la fibrillation atriale non valvulaire et guide l'indication d'anticoagulation.",
      aliases: ['chads vasc', 'cha2ds2vasc', 'chadsvasc', 'chads2 vasc', 'cha2ds2 vasc'],
      keywords: [
        'fibrillation atriale',
        'fibrillation auriculaire',
        'ACFA',
        'AVC',
        'accident vasculaire cérébral',
        'anticoagulation',
        'anticoagulant',
        'embolie',
        'thrombose',
        'risque embolique',
      ],
      fields: [
        yesNo('chf', 'Insuffisance cardiaque / dysfonction VG', 1),
        yesNo('htn', 'Hypertension artérielle', 1),
        {
          kind: 'choice',
          id: 'age',
          label: 'Âge',
          options: [
            { label: '< 65 ans', value: 0 },
            { label: '65–74 ans', value: 1 },
            { label: '≥ 75 ans', value: 2 },
          ],
        },
        yesNo('diabetes', 'Diabète', 1),
        yesNo('stroke', 'ATCD AVC / AIT / embolie systémique', 2),
        yesNo('vascular', 'Maladie vasculaire (IDM, AOMI, plaque aortique)', 1),
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
      reference: 'ESC 2020 — FA. Anticoagulation : homme ≥ 2, femme ≥ 3 (le sexe seul ne suffit pas).',
      caution:
        'À croiser avec le risque hémorragique (HAS-BLED). Ne s’applique pas à la FA valvulaire (valve mécanique, RM serré).',
    },
    [
      { min: 0, level: 'low', label: 'Risque faible', detail: 'Score 0 (homme) ou 1 (femme) : risque faible, anticoagulation généralement non indiquée.' },
      { min: 1, level: 'moderate', label: 'Risque intermédiaire', detail: 'Score 1 (homme) : anticoagulation à discuter au cas par cas.' },
      { min: 2, level: 'high', label: 'Risque élevé', detail: 'Anticoagulation orale recommandée (homme ≥ 2, femme ≥ 3), sauf contre-indication.' },
    ],
  ),

  additiveScore(
    {
      id: 'has-bled',
      name: 'Score de risque hémorragique sous anticoagulant',
      acronym: 'HAS-BLED',
      category: 'cardio',
      purpose:
        "Évalue le risque d'hémorragie majeure chez un patient anticoagulé pour fibrillation atriale ; repère surtout les facteurs de risque modifiables.",
      aliases: ['hasbled', 'has bled'],
      keywords: [
        'risque hémorragique',
        'hémorragie',
        'saignement',
        'anticoagulant',
        'anticoagulation',
        'fibrillation atriale',
        'AVK',
        'AOD',
      ],
      fields: [
        yesNo('htn', 'HTA non contrôlée (PAS > 160 mmHg)', 1),
        yesNo('renal', 'Insuffisance rénale (dialyse, greffe, créat > 200 µmol/L)', 1),
        yesNo('liver', 'Insuffisance hépatique (cirrhose, bili > 2N, transa > 3N)', 1),
        yesNo('stroke', 'ATCD d’AVC', 1),
        yesNo('bleeding', 'ATCD ou prédisposition hémorragique (anémie)', 1),
        yesNo('labileInr', 'INR labile / temps dans la cible < 60 % (si AVK)', 1),
        yesNo('elderly', 'Âge > 65 ans', 1),
        yesNo('drugs', 'Médicaments à risque (antiplaquettaire, AINS)', 1),
        yesNo('alcohol', 'Alcool ≥ 8 verres / semaine', 1),
      ],
      reference: 'Pisters 2010 / ESC. Seuil d’alerte : ≥ 3.',
      caution:
        "Un score élevé n'est PAS une contre-indication à l'anticoagulation : il incite à corriger les facteurs modifiables et à surveiller.",
    },
    [
      { min: 0, level: 'low', label: 'Risque non élevé', detail: 'Score 0–2 : risque hémorragique faible à modéré.' },
      { min: 3, level: 'high', label: 'Risque élevé', detail: 'Score ≥ 3 : risque hémorragique élevé — corriger les facteurs modifiables et rapprocher la surveillance.' },
    ],
  ),

  additiveScore(
    {
      id: 'timi-nstemi',
      name: 'Score TIMI (angor instable / NSTEMI)',
      acronym: 'TIMI UA/NSTEMI',
      category: 'cardio',
      purpose:
        "Stratifie le risque d'événement (décès, IDM, revascularisation urgente) à 14 jours dans un syndrome coronarien aigu sans sus-décalage ST.",
      aliases: ['timi', 'timi nstemi', 'timi angor'],
      keywords: [
        'syndrome coronarien aigu',
        'SCA',
        'angor instable',
        'NSTEMI',
        'infarctus',
        'douleur thoracique',
        'troponine',
        'risque coronarien',
      ],
      fields: [
        yesNo('age', 'Âge ≥ 65 ans', 1),
        yesNo('riskFactors', '≥ 3 facteurs de risque coronarien', 1, 'HTA, diabète, dyslipidémie, tabac, ATCD familiaux'),
        yesNo('knownCad', 'Coronaropathie connue (sténose ≥ 50 %)', 1),
        yesNo('aspirin', 'Aspirine dans les 7 derniers jours', 1),
        yesNo('angina', 'Angor sévère (≥ 2 épisodes / 24 h)', 1),
        yesNo('stDeviation', 'Décalage ST ≥ 0,5 mm', 1),
        yesNo('markers', 'Marqueurs cardiaques élevés (troponine)', 1),
      ],
      reference: 'Antman 2000 (TIMI). Score 0–7.',
    },
    [
      { min: 0, level: 'low', label: 'Risque faible', detail: 'Score 0–2 : risque d’événement à 14 j ≈ 5–8 %.' },
      { min: 3, level: 'moderate', label: 'Risque intermédiaire', detail: 'Score 3–4 : risque ≈ 13–20 % — stratégie invasive à discuter.' },
      { min: 5, level: 'high', label: 'Risque élevé', detail: 'Score 5–7 : risque ≈ 26–41 % — stratégie invasive précoce.' },
    ],
  ),

  additiveScore(
    {
      id: 'chads2',
      name: 'Score CHADS₂ (risque d’AVC dans la fibrillation atriale)',
      acronym: 'CHADS₂',
      category: 'cardio',
      purpose:
        "Version historique (antérieure au CHA₂DS₂-VASc) d'estimation du risque d'AVC dans la fibrillation atriale.",
      aliases: ['chads2', 'chads', 'chads 2'],
      keywords: ['fibrillation atriale', 'ACFA', 'AVC', 'anticoagulation', 'risque embolique'],
      fields: [
        yesNo('chf', 'Insuffisance cardiaque', 1),
        yesNo('htn', 'Hypertension artérielle', 1),
        yesNo('age', 'Âge ≥ 75 ans', 1),
        yesNo('diabetes', 'Diabète', 1),
        yesNo('stroke', 'ATCD AVC / AIT', 2),
      ],
      reference: 'Gage 2001. Aujourd’hui supplanté par le CHA₂DS₂-VASc (plus discriminant à bas risque).',
    },
    [
      { min: 0, level: 'low', label: 'Risque faible', detail: 'Score 0 : risque annuel d’AVC ≈ 1,9 %.' },
      { min: 1, level: 'moderate', label: 'Risque intermédiaire', detail: 'Score 1–2 : risque annuel ≈ 2,8–4 %.' },
      { min: 3, level: 'high', label: 'Risque élevé', detail: 'Score ≥ 3 : risque annuel ≥ 5,9 % — anticoagulation.' },
    ],
  ),

  additiveScore(
    {
      id: 'nyha',
      name: 'Classification NYHA (insuffisance cardiaque)',
      acronym: 'NYHA',
      category: 'cardio',
      purpose:
        "Cote le retentissement fonctionnel de l'insuffisance cardiaque (dyspnée) en 4 stades.",
      aliases: ['nyha', 'classification nyha', 'stade insuffisance cardiaque', 'dyspnee nyha'],
      keywords: ['insuffisance cardiaque', 'dyspnée', 'essoufflement', 'classe fonctionnelle', 'cardiologie'],
      fields: [
        {
          kind: 'choice',
          id: 'class',
          label: 'Retentissement fonctionnel',
          options: [
            { label: 'I — Aucune limitation', value: 1 },
            { label: 'II — Dyspnée aux efforts importants', value: 2 },
            { label: 'III — Dyspnée aux efforts modérés (limitation marquée)', value: 3 },
            { label: 'IV — Dyspnée au moindre effort ou au repos', value: 4 },
          ],
        },
      ],
      reference: 'New York Heart Association. Classe fonctionnelle I–IV.',
    },
    [
      { min: 1, level: 'low', label: 'Classe I', detail: 'Aucune limitation de l’activité physique ordinaire.' },
      { min: 2, level: 'moderate', label: 'Classe II', detail: 'Limitation légère : gêne aux efforts importants.' },
      { min: 3, level: 'high', label: 'Classe III', detail: 'Limitation marquée : gêne aux efforts modérés de la vie courante.' },
      { min: 4, level: 'critical', label: 'Classe IV', detail: 'Symptômes au moindre effort ou au repos.' },
    ],
    { format: (t) => `Classe NYHA ${CARDIO_ROMAN[t - 1] ?? t}` },
  ),

  additiveScore(
    {
      id: 'killip',
      name: 'Classification de Killip (infarctus du myocarde)',
      acronym: 'Killip',
      category: 'cardio',
      purpose:
        "Stratifie la gravité hémodynamique et le pronostic à la phase aiguë d'un infarctus du myocarde.",
      aliases: ['killip', 'classification killip', 'killip kimball'],
      keywords: ['infarctus', 'IDM', 'insuffisance cardiaque aiguë', 'OAP', 'choc cardiogénique', 'pronostic', 'cardiologie'],
      fields: [
        {
          kind: 'choice',
          id: 'class',
          label: 'Signes d’insuffisance cardiaque',
          options: [
            { label: 'I — Aucun signe', value: 1 },
            { label: 'II — Râles crépitants, B3, turgescence jugulaire', value: 2 },
            { label: 'III — Œdème aigu du poumon', value: 3 },
            { label: 'IV — Choc cardiogénique', value: 4 },
          ],
        },
      ],
      reference: 'Killip & Kimball 1967. Mortalité hospitalière croissante (≈ 6 % → 80 %).',
    },
    [
      { min: 1, level: 'low', label: 'Classe I', detail: 'Pas d’insuffisance cardiaque — mortalité hospitalière ≈ 6 %.' },
      { min: 2, level: 'moderate', label: 'Classe II', detail: 'Insuffisance cardiaque modérée — mortalité ≈ 17 %.' },
      { min: 3, level: 'high', label: 'Classe III', detail: 'Œdème aigu du poumon — mortalité ≈ 38 %.' },
      { min: 4, level: 'critical', label: 'Classe IV', detail: 'Choc cardiogénique — mortalité ≈ 67–80 %.' },
    ],
    { format: (t) => `Classe Killip ${CARDIO_ROMAN[t - 1] ?? t}` },
  ),

  additiveScore(
    {
      id: 'heart',
      name: 'Score HEART (douleur thoracique aux urgences)',
      acronym: 'HEART',
      category: 'cardio',
      purpose:
        "Stratifie le risque d'événement cardiaque majeur à 6 semaines devant une douleur thoracique aux urgences.",
      aliases: ['heart', 'heart score', 'douleur thoracique urgences'],
      keywords: ['douleur thoracique', 'syndrome coronarien', 'urgences', 'troponine', 'ECG', 'risque coronarien'],
      fields: [
        {
          kind: 'choice',
          id: 'history',
          label: 'Anamnèse (typicité)',
          options: [
            { label: 'Peu suspecte', value: 0 },
            { label: 'Moyennement suspecte', value: 1 },
            { label: 'Très suspecte', value: 2 },
          ],
        },
        {
          kind: 'choice',
          id: 'ecg',
          label: 'ECG',
          options: [
            { label: 'Normal', value: 0 },
            { label: 'Trouble de repolarisation non spécifique', value: 1 },
            { label: 'Décalage significatif du ST', value: 2 },
          ],
        },
        {
          kind: 'choice',
          id: 'age',
          label: 'Âge',
          options: [
            { label: '< 45 ans', value: 0 },
            { label: '45–64 ans', value: 1 },
            { label: '≥ 65 ans', value: 2 },
          ],
        },
        {
          kind: 'choice',
          id: 'riskFactors',
          label: 'Facteurs de risque',
          options: [
            { label: 'Aucun', value: 0 },
            { label: '1 à 2 facteurs', value: 1 },
            { label: '≥ 3 facteurs ou athérome connu', value: 2 },
          ],
        },
        {
          kind: 'choice',
          id: 'troponin',
          label: 'Troponine',
          options: [
            { label: '≤ normale', value: 0 },
            { label: '1 à 3× la normale', value: 1 },
            { label: '> 3× la normale', value: 2 },
          ],
        },
      ],
      reference: 'Six 2008. 0–3 faible, 4–6 intermédiaire, 7–10 élevé.',
    },
    [
      { min: 0, level: 'low', label: 'Risque faible', detail: 'Score 0–3 : événement cardiaque majeur à 6 sem ≈ 1,7 % — sortie souvent possible.' },
      { min: 4, level: 'moderate', label: 'Risque intermédiaire', detail: 'Score 4–6 : risque ≈ 12–17 % — observation / bilan.' },
      { min: 7, level: 'high', label: 'Risque élevé', detail: 'Score 7–10 : risque ≈ 50 % — prise en charge cardiologique.' },
    ],
  ),

  {
    id: 'qtc',
    name: 'QT corrigé (Bazett, Fridericia, Framingham, Hodges)',
    acronym: 'QTc',
    category: 'cardio',
    purpose:
      "Corrige l'intervalle QT en fonction de la fréquence cardiaque (4 formules au choix) pour dépister un QT long (risque de torsades de pointes).",
    aliases: ['qtc', 'qt corrige', 'bazett', 'fridericia', 'framingham', 'hodges', 'qt long', 'intervalle qt'],
    keywords: ['QT', 'QT long', 'QTc', 'torsades de pointes', 'ECG', 'arythmie', 'repolarisation', 'cardiologie'],
    fields: [
      { kind: 'number', id: 'qt', label: 'Intervalle QT mesuré', unit: 'ms', min: 200, max: 700, placeholder: 'ex. 400' },
      { kind: 'number', id: 'hr', label: 'Fréquence cardiaque', unit: '/min', min: 30, max: 220, placeholder: 'ex. 75' },
      {
        kind: 'choice',
        id: 'formula',
        label: 'Formule de correction',
        help: 'Bazett = usuelle mais imprécise aux FC extrêmes ; Fridericia/Framingham souvent préférées.',
        options: [
          { label: 'Bazett (QT/√RR)', value: 0 },
          { label: 'Fridericia (QT/RR^⅓)', value: 1 },
          { label: 'Framingham (QT + 154 × (1 − RR))', value: 2 },
          { label: 'Hodges (QT + 1,75 × (FC − 60))', value: 3 },
        ],
      },
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
    reference:
      'Bazett 1920, Fridericia 1920, Sagie (Framingham) 1992, Hodges 1983. RR = 60/FC (s). Normale ≤ 450 ms (H) / 470 ms (F) ; risque de TdP si > 500 ms.',
    caution: 'Bazett sur-corrige aux fréquences extrêmes (préférer Fridericia/Framingham) ; recouper avec la clinique.',
    compute: (v) => {
      const qt = v.qt;
      const hr = v.hr;
      if (!Number.isFinite(qt) || !Number.isFinite(hr) || hr <= 0) {
        return incompleteResultCardio('Renseignez le QT et la fréquence cardiaque.');
      }
      const rr = 60 / hr; // intervalle RR en secondes
      let qtc: number;
      switch (v.formula) {
        case 1: qtc = qt / Math.cbrt(rr); break; // Fridericia
        case 2: qtc = qt + 154 * (1 - rr); break; // Framingham (Sagie)
        case 3: qtc = qt + 1.75 * (hr - 60); break; // Hodges
        default: qtc = qt / Math.sqrt(rr); // Bazett
      }
      const female = v.sex === 1;
      let interpretation: ScoreInterpretation;
      if (qtc >= 500) interpretation = { level: 'critical', label: 'Allongement majeur', detail: 'QTc ≥ 500 ms : risque élevé de torsades de pointes — corriger les facteurs (kaliémie, magnésémie, médicaments).' };
      else if (qtc > (female ? 470 : 450)) interpretation = { level: 'high', label: 'QTc allongé', detail: `QTc > ${female ? 470 : 450} ms : QT long — rechercher une cause (médicaments, ionogramme).` };
      else if (qtc >= (female ? 450 : 430)) interpretation = { level: 'moderate', label: 'QTc limite', detail: 'QTc limite supérieur — surveillance.' };
      else interpretation = { level: 'low', label: 'QTc normal', detail: 'QTc dans les limites de la normale.' };
      return { value: qtc, display: `${fmt(qtc)} ms`, interpretation };
    },
  },
];

const incompleteResultCardio = (msg: string): ReturnType<ScoreDefinition['compute']> => ({
  value: NaN,
  display: '—',
  incomplete: true,
  interpretation: { level: 'info', label: 'Champs à compléter', detail: msg },
});
