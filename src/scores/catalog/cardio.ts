/**
 * Scores CARDIOLOGIE / RYTHME.
 * Critères figés + testés (tests/unit/scores.test.ts). Aide à la décision, pas un diagnostic.
 */
import { additiveScore, yesNo, type ScoreDefinition } from '../types';

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
];
