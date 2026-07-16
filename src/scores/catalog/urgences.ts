/**
 * Scores URGENCES / RÉANIMATION.
 * Profondeur de coma, détérioration clinique précoce, index de choc.
 */
import { additiveScore, fmt, yesNo, type ScoreDefinition } from '../types';

export const URGENCES_SCORES: ScoreDefinition[] = [
  additiveScore(
    {
      id: 'glasgow',
      name: 'Échelle de coma de Glasgow',
      acronym: 'GCS',
      category: 'urgences',
      purpose:
        "Quantifie l'état de conscience (ouverture des yeux, réponse verbale, réponse motrice) pour suivre une atteinte neurologique.",
      aliases: ['glasgow', 'gcs', 'coma', 'echelle de glasgow', 'score de glasgow'],
      keywords: [
        'conscience',
        'coma',
        'traumatisme crânien',
        'neurologie',
        'vigilance',
        'intubation',
        'trouble de conscience',
      ],
      fields: [
        {
          kind: 'choice',
          id: 'eye',
          label: 'Ouverture des yeux (Y)',
          options: [
            { label: 'Spontanée', value: 4 },
            { label: 'À la demande (voix)', value: 3 },
            { label: 'À la douleur', value: 2 },
            { label: 'Aucune', value: 1 },
          ],
        },
        {
          kind: 'choice',
          id: 'verbal',
          label: 'Réponse verbale (V)',
          options: [
            { label: 'Orientée, cohérente', value: 5 },
            { label: 'Confuse', value: 4 },
            { label: 'Mots inappropriés', value: 3 },
            { label: 'Sons incompréhensibles', value: 2 },
            { label: 'Aucune', value: 1 },
          ],
        },
        {
          kind: 'choice',
          id: 'motor',
          label: 'Réponse motrice (M)',
          options: [
            { label: 'Obéit aux ordres', value: 6 },
            { label: 'Localise la douleur', value: 5 },
            { label: 'Évitement (retrait) à la douleur', value: 4 },
            { label: 'Flexion anormale (décortication)', value: 3 },
            { label: 'Extension (décérébration)', value: 2 },
            { label: 'Aucune', value: 1 },
          ],
        },
      ],
      reference: 'Teasdale & Jennett 1974. Score 3–15. Noter le détail Y-V-M.',
      caution: 'Un Glasgow ≤ 8 impose de protéger les voies aériennes (intubation).',
    },
    [
      { min: 3, level: 'critical', label: 'Atteinte grave', detail: 'Score 3–8 : trouble de conscience grave / coma — protection des voies aériennes (intubation si ≤ 8).' },
      { min: 9, level: 'moderate', label: 'Atteinte modérée', detail: 'Score 9–12 : atteinte de conscience modérée — surveillance neurologique rapprochée.' },
      { min: 13, level: 'low', label: 'Atteinte légère', detail: 'Score 13–15 : conscience peu ou pas altérée.' },
    ],
  ),

  additiveScore(
    {
      id: 'news2',
      name: 'National Early Warning Score 2',
      acronym: 'NEWS2',
      category: 'urgences',
      purpose:
        "Détecte précocement la détérioration clinique d'un patient hospitalisé à partir de 7 paramètres vitaux.",
      aliases: ['news', 'news2', 'early warning score'],
      keywords: [
        'paramètres vitaux',
        'détérioration',
        'surveillance',
        'sepsis',
        'alerte précoce',
        'constantes',
        'gravité',
      ],
      fields: [
        {
          kind: 'choice',
          id: 'respRate',
          label: 'Fréquence respiratoire (/min)',
          options: [
            { label: '12–20', value: 0 },
            { label: '9–11', value: 1 },
            { label: '21–24', value: 2 },
            { label: '≤ 8', value: 3 },
            { label: '≥ 25', value: 3 },
          ],
        },
        {
          kind: 'choice',
          id: 'spo2',
          label: 'SpO₂ (échelle 1, %)',
          options: [
            { label: '≥ 96', value: 0 },
            { label: '94–95', value: 1 },
            { label: '92–93', value: 2 },
            { label: '≤ 91', value: 3 },
          ],
        },
        {
          kind: 'choice',
          id: 'oxygen',
          label: 'Apport en oxygène',
          options: [
            { label: 'Air ambiant', value: 0 },
            { label: 'Oxygène', value: 2 },
          ],
        },
        {
          kind: 'choice',
          id: 'sbp',
          label: 'Pression artérielle systolique (mmHg)',
          options: [
            { label: '111–219', value: 0 },
            { label: '101–110', value: 1 },
            { label: '91–100', value: 2 },
            { label: '≤ 90', value: 3 },
            { label: '≥ 220', value: 3 },
          ],
        },
        {
          kind: 'choice',
          id: 'pulse',
          label: 'Fréquence cardiaque (/min)',
          options: [
            { label: '51–90', value: 0 },
            { label: '41–50', value: 1 },
            { label: '91–110', value: 1 },
            { label: '111–130', value: 2 },
            { label: '≤ 40', value: 3 },
            { label: '≥ 131', value: 3 },
          ],
        },
        {
          kind: 'choice',
          id: 'consciousness',
          label: 'Conscience',
          options: [
            { label: 'Alerte', value: 0 },
            { label: 'Nouvelle confusion / réponse à la voix, douleur ou aucune (V-P-U)', value: 3 },
          ],
        },
        {
          kind: 'choice',
          id: 'temperature',
          label: 'Température (°C)',
          options: [
            { label: '36,1–38,0', value: 0 },
            { label: '35,1–36,0', value: 1 },
            { label: '38,1–39,0', value: 1 },
            { label: '≥ 39,1', value: 2 },
            { label: '≤ 35,0', value: 3 },
          ],
        },
      ],
      reference: 'Royal College of Physicians 2017. SpO₂ échelle 1 (échelle 2 pour l’insuffisance respiratoire hypercapnique).',
      caution: 'Un seul paramètre coté 3 justifie déjà une réévaluation médicale urgente, même si le total est bas.',
    },
    [
      { min: 0, level: 'low', label: 'Risque faible', detail: 'Score 0–4 : surveillance de routine (rester attentif à tout paramètre coté 3).' },
      { min: 5, level: 'moderate', label: 'Risque intermédiaire', detail: 'Score 5–6 : réévaluation médicale urgente, surveillance rapprochée.' },
      { min: 7, level: 'high', label: 'Risque élevé', detail: 'Score ≥ 7 : réponse en urgence, envisager les soins critiques.' },
    ],
  ),

  {
    id: 'index-de-choc',
    name: 'Index de choc',
    acronym: 'Shock index',
    category: 'urgences',
    purpose:
      "Rapport fréquence cardiaque / pression artérielle systolique : repère une hypovolémie ou un choc débutant que des constantes prises isolément peuvent masquer.",
    aliases: ['index de choc', 'shock index', 'indice de choc'],
    keywords: ['choc', 'hypovolémie', 'hémorragie', 'fréquence cardiaque', 'pression artérielle', 'tachycardie'],
    fields: [
      { kind: 'number', id: 'hr', label: 'Fréquence cardiaque', unit: '/min', min: 20, max: 250, placeholder: 'ex. 110' },
      { kind: 'number', id: 'sbp', label: 'Pression artérielle systolique', unit: 'mmHg', min: 40, max: 260, placeholder: 'ex. 100' },
    ],
    reference: 'Allgöwer & Burri 1967. Normale 0,5–0,7 ; ≥ 0,9 péjoratif.',
    compute: (v) => {
      const hr = v.hr;
      const sbp = v.sbp;
      if (!Number.isFinite(hr) || !Number.isFinite(sbp) || sbp <= 0) {
        return {
          value: NaN,
          display: '—',
          incomplete: true,
          interpretation: { level: 'info', label: 'Champs à compléter', detail: 'Renseignez la fréquence cardiaque et la PAS.' },
        };
      }
      const ratio = hr / sbp;
      let interpretation;
      if (ratio < 0.7) {
        interpretation = { level: 'low' as const, label: 'Normal', detail: 'Index 0,5–0,7 : hémodynamique rassurante.' };
      } else if (ratio <= 0.9) {
        interpretation = { level: 'moderate' as const, label: 'Limite', detail: 'Index 0,7–0,9 : surveiller, rechercher une cause d’instabilité.' };
      } else {
        interpretation = { level: 'high' as const, label: 'Élevé', detail: 'Index > 0,9 : évoquer un choc / une hypovolémie occulte — réévaluation urgente.' };
      }
      return { value: ratio, display: fmt(ratio, 2), interpretation };
    },
  },

  additiveScore(
    {
      id: 'sofa',
      name: 'Sequential Organ Failure Assessment (SOFA)',
      acronym: 'SOFA',
      category: 'urgences',
      purpose:
        "Quantifie la défaillance de 6 organes en réanimation ; une hausse ≥ 2 points sur un terrain infectieux définit le sepsis (Sepsis-3).",
      aliases: ['sofa', 'sequential organ failure', 'defaillance multiviscerale'],
      keywords: ['sepsis', 'réanimation', 'défaillance d’organe', 'gravité', 'mortalité', 'choc septique', 'pronostic'],
      fields: [
        {
          kind: 'choice',
          id: 'respiration',
          label: 'Respiration — PaO₂/FiO₂ (mmHg)',
          options: [
            { label: '≥ 400', value: 0 },
            { label: '< 400', value: 1 },
            { label: '< 300', value: 2 },
            { label: '< 200 avec support ventilatoire', value: 3 },
            { label: '< 100 avec support ventilatoire', value: 4 },
          ],
        },
        {
          kind: 'choice',
          id: 'coagulation',
          label: 'Coagulation — plaquettes (×10³/µL)',
          options: [
            { label: '≥ 150', value: 0 },
            { label: '< 150', value: 1 },
            { label: '< 100', value: 2 },
            { label: '< 50', value: 3 },
            { label: '< 20', value: 4 },
          ],
        },
        {
          kind: 'choice',
          id: 'liver',
          label: 'Foie — bilirubine (µmol/L)',
          options: [
            { label: '< 20', value: 0 },
            { label: '20–32', value: 1 },
            { label: '33–101', value: 2 },
            { label: '102–204', value: 3 },
            { label: '> 204', value: 4 },
          ],
        },
        {
          kind: 'choice',
          id: 'cardiovascular',
          label: 'Cardiovasculaire',
          options: [
            { label: 'PAM ≥ 70 mmHg', value: 0 },
            { label: 'PAM < 70 mmHg', value: 1 },
            { label: 'Dopamine ≤ 5 ou dobutamine', value: 2 },
            { label: 'Dopamine > 5 ou noradrénaline ≤ 0,1', value: 3 },
            { label: 'Dopamine > 15 ou noradrénaline > 0,1', value: 4 },
          ],
        },
        {
          kind: 'choice',
          id: 'cns',
          label: 'Neurologique — Glasgow',
          options: [
            { label: '15', value: 0 },
            { label: '13–14', value: 1 },
            { label: '10–12', value: 2 },
            { label: '6–9', value: 3 },
            { label: '< 6', value: 4 },
          ],
        },
        {
          kind: 'choice',
          id: 'renal',
          label: 'Rénal — créatinine (µmol/L)',
          options: [
            { label: '< 110', value: 0 },
            { label: '110–170', value: 1 },
            { label: '171–299', value: 2 },
            { label: '300–440', value: 3 },
            { label: '> 440', value: 4 },
          ],
        },
      ],
      reference: 'Vincent 1996 / Sepsis-3. Score 0–24. Sepsis = hausse ≥ 2 sur infection.',
    },
    [
      { min: 0, level: 'low', label: 'Défaillance faible', detail: 'Score 0–6 : mortalité globalement < 10 %.' },
      { min: 7, level: 'moderate', label: 'Défaillance modérée', detail: 'Score 7–9 : mortalité ≈ 15–20 %.' },
      { min: 10, level: 'high', label: 'Défaillance sévère', detail: 'Score 10–12 : mortalité ≈ 40–50 %.' },
      { min: 13, level: 'critical', label: 'Défaillance très sévère', detail: 'Score ≥ 13 : mortalité > 50 %.' },
    ],
  ),

  additiveScore(
    {
      id: 'sirs',
      name: 'Critères de SIRS (réponse inflammatoire systémique)',
      acronym: 'SIRS',
      category: 'urgences',
      purpose:
        "Repère un syndrome de réponse inflammatoire systémique (≥ 2 critères) ; sensible mais peu spécifique.",
      aliases: ['sirs', 'reponse inflammatoire systemique', 'syndrome inflammatoire'],
      keywords: ['sepsis', 'infection', 'inflammation', 'fièvre', 'tachycardie', 'urgences'],
      fields: [
        yesNo('temp', 'Température > 38 °C ou < 36 °C', 1),
        yesNo('hr', 'Fréquence cardiaque > 90/min', 1),
        yesNo('rr', 'Fréquence respiratoire > 20/min (ou PaCO₂ < 32 mmHg)', 1),
        yesNo('wbc', 'Leucocytes > 12 000 ou < 4 000 /mm³ (ou > 10 % formes jeunes)', 1),
      ],
      reference: 'Bone 1992. Seuil : ≥ 2 critères.',
      caution: 'Peu spécifique : un SIRS peut être non infectieux (pancréatite, brûlure, chirurgie).',
    },
    [
      { min: 0, level: 'low', label: 'Pas de SIRS', detail: 'Moins de 2 critères : pas de SIRS.' },
      { min: 2, level: 'moderate', label: 'SIRS présent', detail: '≥ 2 critères : SIRS — rechercher une cause (infectieuse ou non).' },
    ],
  ),
];
