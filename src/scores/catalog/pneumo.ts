/**
 * Scores PNEUMOLOGIE / INFECTIOLOGIE.
 * Gravité de pneumonie, sepsis au lit du patient, angine à streptocoque.
 */
import { additiveScore, yesNo, type ScoreDefinition } from '../types';

export const PNEUMO_SCORES: ScoreDefinition[] = [
  additiveScore(
    {
      id: 'curb-65',
      name: 'Score CURB-65 (gravité de la pneumonie communautaire)',
      acronym: 'CURB-65',
      category: 'pneumo',
      purpose:
        "Évalue la gravité d'une pneumonie aiguë communautaire et oriente entre prise en charge ambulatoire, hospitalisation ou réanimation.",
      aliases: ['curb', 'curb65', 'curb 65'],
      keywords: [
        'pneumonie',
        'pneumopathie',
        'infection pulmonaire',
        'gravité',
        'hospitalisation',
        'ambulatoire',
        'sepsis respiratoire',
      ],
      fields: [
        yesNo('confusion', 'Confusion', 1),
        yesNo('urea', 'Urée > 7 mmol/L', 1),
        yesNo('respRate', 'Fréquence respiratoire ≥ 30/min', 1),
        yesNo('bp', 'PAS < 90 mmHg ou PAD ≤ 60 mmHg', 1),
        yesNo('age', 'Âge ≥ 65 ans', 1),
      ],
      reference: 'Lim 2003 (BTS). Score 0–5.',
    },
    [
      { min: 0, level: 'low', label: 'Faible gravité', detail: 'Score 0–1 : mortalité < 3 % — traitement ambulatoire possible.' },
      { min: 2, level: 'moderate', label: 'Gravité intermédiaire', detail: 'Score 2 : mortalité ≈ 9 % — hospitalisation ou surveillance rapprochée.' },
      { min: 3, level: 'high', label: 'Gravité élevée', detail: 'Score ≥ 3 : mortalité 15–40 % — hospitalisation, envisager la réanimation.' },
    ],
  ),

  additiveScore(
    {
      id: 'crb-65',
      name: 'Score CRB-65 (pneumonie, sans biologie)',
      acronym: 'CRB-65',
      category: 'pneumo',
      purpose:
        "Version du CURB-65 sans dosage de l'urée, utilisable en ville pour décider d'une hospitalisation.",
      aliases: ['crb', 'crb65', 'crb 65'],
      keywords: ['pneumonie', 'ville', 'médecine générale', 'gravité', 'hospitalisation', 'ambulatoire'],
      fields: [
        yesNo('confusion', 'Confusion', 1),
        yesNo('respRate', 'Fréquence respiratoire ≥ 30/min', 1),
        yesNo('bp', 'PAS < 90 mmHg ou PAD ≤ 60 mmHg', 1),
        yesNo('age', 'Âge ≥ 65 ans', 1),
      ],
      reference: 'Score 0–4. En ville, tout score ≥ 1 fait discuter l’hospitalisation.',
    },
    [
      { min: 0, level: 'low', label: 'Faible gravité', detail: 'Score 0 : mortalité faible — traitement ambulatoire possible.' },
      { min: 1, level: 'moderate', label: 'Gravité intermédiaire', detail: 'Score 1–2 : hospitalisation à envisager.' },
      { min: 3, level: 'high', label: 'Gravité élevée', detail: 'Score 3–4 : hospitalisation urgente.' },
    ],
  ),

  additiveScore(
    {
      id: 'qsofa',
      name: 'Quick SOFA (sepsis au lit du patient)',
      acronym: 'qSOFA',
      category: 'pneumo',
      purpose:
        "Repère rapidement, hors réanimation, les patients infectés à risque d'évolution défavorable (sepsis).",
      aliases: ['qsofa', 'quick sofa', 'q-sofa'],
      keywords: [
        'sepsis',
        'infection',
        'gravité',
        'mortalité',
        'défaillance',
        'urgences',
        'choc septique',
      ],
      fields: [
        yesNo('respRate', 'Fréquence respiratoire ≥ 22/min', 1),
        yesNo('mentalStatus', 'Altération de la conscience (Glasgow < 15)', 1),
        yesNo('bp', 'PAS ≤ 100 mmHg', 1),
      ],
      reference: 'Sepsis-3 (Singer 2016). Seuil : ≥ 2.',
      caution: 'Outil de dépistage, pas de diagnostic : un qSOFA < 2 n’exclut pas un sepsis.',
    },
    [
      { min: 0, level: 'low', label: 'Risque faible', detail: 'Score < 2 : risque de mortalité plus faible — rester vigilant.' },
      { min: 2, level: 'high', label: 'Risque élevé', detail: 'Score ≥ 2 : mortalité accrue — évaluer une défaillance d’organe (SOFA, lactate) et surveiller.' },
    ],
  ),

  additiveScore(
    {
      id: 'centor-mcisaac',
      name: 'Score de Centor modifié (McIsaac) — angine',
      acronym: 'Centor / McIsaac',
      category: 'pneumo',
      purpose:
        "Estime la probabilité qu'une angine soit à streptocoque du groupe A et guide l'indication du test de diagnostic rapide (TDR).",
      aliases: ['centor', 'mcisaac', 'mac isaac', 'score angine', 'angine streptocoque'],
      keywords: [
        'angine',
        'pharyngite',
        'mal de gorge',
        'streptocoque',
        'TDR',
        'antibiotiques',
        'amygdales',
      ],
      fields: [
        yesNo('exudate', 'Exsudat / gonflement amygdalien', 1),
        yesNo('nodes', 'Adénopathies cervicales antérieures sensibles', 1),
        yesNo('fever', 'Fièvre > 38 °C', 1),
        yesNo('noCough', 'Absence de toux', 1),
        {
          kind: 'choice',
          id: 'age',
          label: 'Âge',
          options: [
            { label: '3–14 ans', value: 1 },
            { label: '15–44 ans', value: 0 },
            { label: '≥ 45 ans', value: -1 },
          ],
        },
      ],
      reference: 'McIsaac 1998. En France : TDR recommandé dès un score ≥ 2 (et chez l’enfant ≥ 3 ans).',
      caution: 'Chez l’adulte, l’antibiothérapie ne se justifie qu’avec un TDR positif.',
    },
    [
      { min: -1, level: 'low', label: 'Probabilité faible', detail: 'Score ≤ 1 : angine probablement virale — pas de TDR ni d’antibiotiques.' },
      { min: 2, level: 'moderate', label: 'Probabilité intermédiaire', detail: 'Score 2–3 : réaliser un TDR ; antibiotiques si positif.' },
      { min: 4, level: 'high', label: 'Probabilité forte', detail: 'Score ≥ 4 : probabilité de SGA élevée (~ 50 %) — TDR puis antibiothérapie si positif.' },
    ],
  ),
];
