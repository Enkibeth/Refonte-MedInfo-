/**
 * Scores ANESTHÉSIE / PÉRI-OPÉRATOIRE.
 * Risque cardiaque péri-op (RCRI), nausées-vomissements post-op (Apfel), état
 * physique pré-anesthésique (ASA).
 */
import { additiveScore, yesNo, type ScoreDefinition } from '../types';

const ASA_ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

export const ANESTHESIE_SCORES: ScoreDefinition[] = [
  additiveScore(
    {
      id: 'rcri',
      name: 'Indice de risque cardiaque révisé (Lee)',
      acronym: 'RCRI',
      category: 'anesthesie',
      purpose:
        "Estime le risque de complication cardiaque majeure d'une chirurgie non cardiaque.",
      aliases: ['rcri', 'lee', 'revised cardiac risk index', 'indice de lee'],
      keywords: [
        'risque cardiaque',
        'péri-opératoire',
        'chirurgie',
        'anesthésie',
        'évaluation préopératoire',
        'complication cardiaque',
      ],
      fields: [
        yesNo('surgery', 'Chirurgie à haut risque (intrapéritonéale, intrathoracique, vasculaire sus-inguinale)', 1),
        yesNo('ischemic', 'Cardiopathie ischémique', 1),
        yesNo('heartFailure', 'Insuffisance cardiaque', 1),
        yesNo('cerebrovascular', 'ATCD d’AVC / AIT', 1),
        yesNo('diabetes', 'Diabète insulino-traité', 1),
        yesNo('renal', 'Créatininémie > 177 µmol/L (2 mg/dL)', 1),
      ],
      reference: 'Lee 1999. Classes I (0) à IV (≥ 3).',
    },
    [
      { min: 0, level: 'low', label: 'Risque faible', detail: 'Score 0–1 : complication cardiaque majeure < 1 %.' },
      { min: 2, level: 'moderate', label: 'Risque intermédiaire', detail: 'Score 2 : risque ≈ 7 %.' },
      { min: 3, level: 'high', label: 'Risque élevé', detail: 'Score ≥ 3 : risque ≈ 11 % — optimisation et avis cardiologique.' },
    ],
  ),

  additiveScore(
    {
      id: 'apfel',
      name: 'Score d’Apfel (nausées-vomissements post-opératoires)',
      acronym: 'Apfel',
      category: 'anesthesie',
      purpose:
        "Estime le risque de nausées et vomissements post-opératoires (NVPO) et guide la prophylaxie anti-émétique.",
      aliases: ['apfel', 'nvpo', 'ponv', 'nausees vomissements post operatoires'],
      keywords: ['nausées', 'vomissements', 'post-opératoire', 'NVPO', 'anesthésie', 'anti-émétique'],
      fields: [
        yesNo('female', 'Sexe féminin', 1),
        yesNo('nonSmoker', 'Non-fumeur', 1),
        yesNo('history', 'ATCD de NVPO ou mal des transports', 1),
        yesNo('opioids', 'Opioïdes en post-opératoire (prévus)', 1),
      ],
      reference: 'Apfel 1999. Risque de NVPO ≈ 10 / 20 / 40 / 60 / 80 % pour 0 / 1 / 2 / 3 / 4.',
    },
    [
      { min: 0, level: 'low', label: 'Risque faible', detail: 'Score 0–1 : NVPO ≈ 10–20 %.' },
      { min: 2, level: 'moderate', label: 'Risque intermédiaire', detail: 'Score 2 : NVPO ≈ 40 % — envisager une prophylaxie.' },
      { min: 3, level: 'high', label: 'Risque élevé', detail: 'Score 3–4 : NVPO ≈ 60–80 % — prophylaxie multimodale.' },
    ],
  ),

  additiveScore(
    {
      id: 'asa',
      name: 'Classification ASA (état physique pré-anesthésique)',
      acronym: 'ASA',
      category: 'anesthesie',
      purpose:
        "Décrit l'état physique du patient avant l'anesthésie (I à VI) — communication du risque, jamais un calcul de mortalité en soi.",
      aliases: ['asa', 'classification asa', 'score asa', 'american society anesthesiologists'],
      keywords: ['anesthésie', 'préopératoire', 'état physique', 'risque anesthésique', 'consultation anesthésie'],
      fields: [
        {
          kind: 'choice',
          id: 'class',
          label: 'État physique',
          options: [
            { label: 'I — Patient sain', value: 1 },
            { label: 'II — Maladie systémique légère (HTA équilibrée, tabac, obésité, grossesse)', value: 2 },
            { label: 'III — Maladie systémique sévère (diabète/HTA mal équilibrés, BPCO)', value: 3 },
            { label: 'IV — Maladie sévère menaçant le pronostic vital', value: 4 },
            { label: 'V — Moribond, survie improbable sans chirurgie', value: 5 },
            { label: 'VI — Mort encéphalique (don d’organes)', value: 6 },
          ],
        },
      ],
      reference: 'ASA Physical Status. Ajouter « U » en cas d’urgence (ex. ASA III-U).',
      caution: 'Évaluation subjective de l’état physique : ce n’est pas un score de mortalité opératoire.',
    },
    [
      { min: 1, level: 'low', label: 'ASA I', detail: 'Patient sain.' },
      { min: 2, level: 'low', label: 'ASA II', detail: 'Maladie systémique légère, sans limitation fonctionnelle.' },
      { min: 3, level: 'moderate', label: 'ASA III', detail: 'Maladie systémique sévère avec limitation fonctionnelle.' },
      { min: 4, level: 'high', label: 'ASA IV', detail: 'Maladie sévère représentant une menace vitale permanente.' },
      { min: 5, level: 'critical', label: 'ASA V', detail: 'Patient moribond, survie improbable sans l’intervention.' },
      { min: 6, level: 'critical', label: 'ASA VI', detail: 'Mort encéphalique, dans le cadre d’un don d’organes.' },
    ],
    { format: (t) => `Classe ASA ${ASA_ROMAN[t - 1] ?? t}` },
  ),

  additiveScore(
    {
      id: 'mallampati',
      name: 'Classification de Mallampati',
      acronym: 'Mallampati',
      category: 'anesthesie',
      purpose:
        "Prédit la difficulté d'intubation à partir de la visibilité des structures oropharyngées, bouche grande ouverte.",
      aliases: ['mallampati', 'intubation difficile', 'classe mallampati'],
      keywords: ['intubation difficile', 'voies aériennes', 'anesthésie', 'oropharynx', 'ventilation'],
      fields: [
        {
          kind: 'choice',
          id: 'class',
          label: 'Structures visibles (bouche ouverte, langue tirée)',
          options: [
            { label: 'I — Voile, luette, piliers visibles', value: 1 },
            { label: 'II — Voile et luette visibles', value: 2 },
            { label: 'III — Voile et base de la luette', value: 3 },
            { label: 'IV — Palais dur seulement (voile non visible)', value: 4 },
          ],
        },
      ],
      reference: 'Mallampati 1985 (modifié Samsoon). Classes III–IV : intubation potentiellement difficile.',
      caution: 'Prédiction imparfaite : à combiner aux autres critères d’intubation difficile.',
    },
    [
      { min: 1, level: 'low', label: 'Classe I–II', detail: 'Intubation a priori non difficile sur ce critère.' },
      { min: 3, level: 'moderate', label: 'Classe III', detail: 'Intubation potentiellement difficile — anticiper.' },
      { min: 4, level: 'high', label: 'Classe IV', detail: 'Risque élevé d’intubation difficile — préparer une stratégie dédiée.' },
    ],
    { format: (t) => `Classe ${ASA_ROMAN[t - 1] ?? t}` },
  ),

  additiveScore(
    {
      id: 'aldrete',
      name: 'Score d’Aldrete (sortie de salle de réveil)',
      acronym: 'Aldrete',
      category: 'anesthesie',
      purpose:
        "Évalue l'aptitude d'un patient à quitter la salle de surveillance post-interventionnelle (SSPI).",
      aliases: ['aldrete', 'score de sortie sspi', 'salle de reveil'],
      keywords: ['salle de réveil', 'SSPI', 'post-opératoire', 'anesthésie', 'sortie', 'surveillance'],
      fields: [
        {
          kind: 'choice',
          id: 'activity',
          label: 'Activité motrice',
          options: [
            { label: 'Bouge les 4 membres', value: 2 },
            { label: 'Bouge 2 membres', value: 1 },
            { label: 'Aucun mouvement', value: 0 },
          ],
        },
        {
          kind: 'choice',
          id: 'respiration',
          label: 'Respiration',
          options: [
            { label: 'Respire et tousse librement', value: 2 },
            { label: 'Dyspnée / respiration limitée', value: 1 },
            { label: 'Apnée', value: 0 },
          ],
        },
        {
          kind: 'choice',
          id: 'circulation',
          label: 'Circulation (PA vs pré-op)',
          options: [
            { label: '± 20 % de la valeur pré-op', value: 2 },
            { label: '± 20 à 50 %', value: 1 },
            { label: '± 50 %', value: 0 },
          ],
        },
        {
          kind: 'choice',
          id: 'consciousness',
          label: 'Conscience',
          options: [
            { label: 'Pleinement réveillé', value: 2 },
            { label: 'Réveillable à l’appel', value: 1 },
            { label: 'Non réactif', value: 0 },
          ],
        },
        {
          kind: 'choice',
          id: 'saturation',
          label: 'Saturation en oxygène',
          options: [
            { label: 'SpO₂ > 92 % à l’air ambiant', value: 2 },
            { label: 'O₂ nécessaire pour SpO₂ > 90 %', value: 1 },
            { label: 'SpO₂ < 90 % même sous O₂', value: 0 },
          ],
        },
      ],
      reference: 'Aldrete 1970/1995. Score 0–10. Sortie de SSPI généralement à ≥ 9.',
    },
    [
      { min: 0, level: 'high', label: 'Surveillance poursuivie', detail: 'Score < 9 : critères de sortie non réunis — poursuivre la surveillance en SSPI.' },
      { min: 9, level: 'low', label: 'Sortie envisageable', detail: 'Score ≥ 9 : critères de sortie de SSPI réunis (selon protocole du service).' },
    ],
  ),
];
