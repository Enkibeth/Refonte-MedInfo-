/**
 * Scores GÉRIATRIE.
 * Dépistage oncogériatrique (G8), dépression (mini-GDS, GDS-15), autonomie
 * (ADL, IADL), cognition (MMSE, MoCA), nutrition (MNA), confusion (CAM),
 * fragilité (Clinical Frailty Scale, Timed Up and Go), escarres (Braden),
 * comorbidités (Charlson).
 *
 * ⚠️ Questionnaires et échelles standardisés : critères figés, couverts par des
 * tests. Aide au repérage, jamais un diagnostic — l'évaluation gériatrique reste
 * clinique.
 */
import {
  additiveScore,
  fmt,
  noYes,
  yesNo,
  type ScoreDefinition,
  type ScoreInterpretation,
} from '../types';

const incompleteResult = (msg: string): ReturnType<ScoreDefinition['compute']> => ({
  value: NaN,
  display: '—',
  incomplete: true,
  interpretation: { level: 'info', label: 'Champs à compléter', detail: msg },
});

export const GERIATRIE_SCORES: ScoreDefinition[] = [
  additiveScore(
    {
      id: 'g8',
      name: 'Questionnaire G8 (dépistage oncogériatrique)',
      acronym: 'G8',
      category: 'geriatrie',
      purpose:
        "Repère, chez le sujet âgé atteint de cancer, ceux qui nécessitent une évaluation gériatrique approfondie (score ≤ 14).",
      aliases: ['g8', 'oncogeriatrie', 'depistage geriatrique cancer'],
      keywords: [
        'oncogériatrie',
        'cancer',
        'sujet âgé',
        'dépistage gériatrique',
        'évaluation gériatrique',
        'personne âgée',
        'fragilité',
      ],
      fields: [
        {
          kind: 'choice',
          id: 'appetite',
          label: 'Prises alimentaires (anorexie, mastication, déglutition)',
          options: [
            { label: 'Anorexie sévère', value: 0 },
            { label: 'Anorexie modérée', value: 1 },
            { label: 'Pas d’anorexie', value: 2 },
          ],
        },
        {
          kind: 'choice',
          id: 'weightLoss',
          label: 'Perte de poids (< 3 mois)',
          options: [
            { label: '> 3 kg', value: 0 },
            { label: 'Ne sait pas', value: 1 },
            { label: '1 à 3 kg', value: 2 },
            { label: 'Pas de perte', value: 3 },
          ],
        },
        {
          kind: 'choice',
          id: 'mobility',
          label: 'Motricité',
          options: [
            { label: 'Du lit au fauteuil', value: 0 },
            { label: 'Autonome à l’intérieur', value: 1 },
            { label: 'Sort du domicile', value: 2 },
          ],
        },
        {
          kind: 'choice',
          id: 'neuro',
          label: 'Problèmes neuropsychologiques',
          options: [
            { label: 'Démence ou dépression sévère', value: 0 },
            { label: 'Démence ou dépression légère', value: 1 },
            { label: 'Pas de problème', value: 2 },
          ],
        },
        {
          kind: 'choice',
          id: 'bmi',
          label: 'Indice de masse corporelle',
          options: [
            { label: '< 19', value: 0 },
            { label: '19 à < 21', value: 1 },
            { label: '21 à < 23', value: 2 },
            { label: '≥ 23', value: 3 },
          ],
        },
        {
          kind: 'choice',
          id: 'drugs',
          label: 'Plus de 3 médicaments par jour',
          options: [
            { label: 'Oui', value: 0 },
            { label: 'Non', value: 1 },
          ],
        },
        {
          kind: 'choice',
          id: 'selfHealth',
          label: 'Santé perçue par rapport aux personnes du même âge',
          options: [
            { label: 'Moins bonne', value: 0 },
            { label: 'Ne sait pas', value: 0.5 },
            { label: 'Aussi bonne', value: 1 },
            { label: 'Meilleure', value: 2 },
          ],
        },
        {
          kind: 'choice',
          id: 'age',
          label: 'Âge',
          options: [
            { label: '> 85 ans', value: 0 },
            { label: '80–85 ans', value: 1 },
            { label: '< 80 ans', value: 2 },
          ],
        },
      ],
      reference: 'Bellera 2012. Score 0–17. Seuil : ≤ 14 → évaluation gériatrique approfondie.',
    },
    [
      { min: 0, level: 'high', label: 'Dépistage positif', detail: 'Score ≤ 14 : évaluation gériatrique approfondie recommandée avant décision thérapeutique.' },
      { min: 14.5, level: 'low', label: 'Dépistage négatif', detail: 'Score > 14 : pas d’altération majeure au dépistage.' },
    ],
    { format: (t) => `${fmt(t, t % 1 === 0 ? 0 : 1)} / 17` },
  ),

  additiveScore(
    {
      id: 'mini-gds',
      name: 'Mini-GDS (dépistage de la dépression du sujet âgé)',
      acronym: 'mini-GDS',
      category: 'geriatrie',
      purpose:
        "Dépistage rapide (4 questions) d'une dépression chez la personne âgée ; un score ≥ 1 impose une évaluation approfondie.",
      aliases: ['mini gds', 'mini-gds', 'minigds', 'gds 4', 'depression sujet age'],
      keywords: [
        'dépression',
        'sujet âgé',
        'personne âgée',
        'humeur',
        'thymie',
        'dépistage',
        'gériatrie',
      ],
      fields: [
        yesNo('sad', 'Vous sentez-vous découragé(e) et triste ?', 1),
        yesNo('empty', 'Avez-vous le sentiment que votre vie est vide ?', 1),
        noYes('happy', 'Êtes-vous heureux(se) la plupart du temps ?', 1),
        yesNo('hopeless', 'Avez-vous l’impression que votre situation est désespérée ?', 1),
      ],
      reference: 'Clément 1997. Score 0–4. Seuil : ≥ 1.',
    },
    [
      { min: 0, level: 'low', label: 'Peu probable', detail: 'Score 0 : forte probabilité d’absence de dépression.' },
      { min: 1, level: 'high', label: 'Dépistage positif', detail: 'Score ≥ 1 : forte probabilité de dépression — évaluation approfondie (GDS-30 ou entretien).' },
    ],
  ),

  additiveScore(
    {
      id: 'gds-15',
      name: 'Échelle de dépression gériatrique (GDS-15)',
      acronym: 'GDS-15',
      category: 'geriatrie',
      purpose:
        "Évalue la sévérité d'une symptomatologie dépressive chez la personne âgée (15 items oui/non).",
      aliases: ['gds', 'gds 15', 'gds-15', 'geriatric depression scale', 'echelle depression geriatrique'],
      keywords: [
        'dépression',
        'sujet âgé',
        'personne âgée',
        'humeur',
        'thymie',
        'gériatrie',
        'échelle dépression',
      ],
      fields: [
        noYes('satisfied', 'Êtes-vous satisfait(e) de votre vie ?', 1),
        yesNo('dropped', 'Avez-vous abandonné beaucoup de vos activités et intérêts ?', 1),
        yesNo('empty', 'Avez-vous le sentiment que votre vie est vide ?', 1),
        yesNo('bored', 'Vous ennuyez-vous souvent ?', 1),
        noYes('goodSpirits', 'Êtes-vous de bonne humeur la plupart du temps ?', 1),
        yesNo('afraid', 'Craignez-vous qu’il vous arrive quelque chose de mauvais ?', 1),
        noYes('happy', 'Êtes-vous heureux(se) la plupart du temps ?', 1),
        yesNo('helpless', 'Vous sentez-vous souvent impuissant(e), sans recours ?', 1),
        yesNo('stayHome', 'Préférez-vous rester chez vous plutôt que sortir ?', 1),
        yesNo('memory', 'Avez-vous plus de problèmes de mémoire que la plupart des gens ?', 1),
        noYes('wonderful', 'Pensez-vous qu’il est merveilleux de vivre à notre époque ?', 1),
        yesNo('worthless', 'Vous sentez-vous plutôt inutile dans votre état actuel ?', 1),
        noYes('energy', 'Vous sentez-vous plein(e) d’énergie ?', 1),
        yesNo('desperate', 'Pensez-vous que votre situation est désespérée ?', 1),
        yesNo('othersBetter', 'Pensez-vous que la plupart des gens sont mieux lotis que vous ?', 1),
      ],
      reference: 'Yesavage / Sheikh 1986 (forme courte). Score 0–15. Seuil de dépression : ≥ 5.',
    },
    [
      { min: 0, level: 'low', label: 'Pas de dépression', detail: 'Score 0–4 : absence de symptomatologie dépressive significative.' },
      { min: 5, level: 'moderate', label: 'Dépression légère à modérée', detail: 'Score 5–9 : symptomatologie dépressive probable — évaluation clinique.' },
      { min: 10, level: 'high', label: 'Dépression sévère', detail: 'Score 10–15 : symptomatologie dépressive marquée — prise en charge spécialisée.' },
    ],
  ),

  additiveScore(
    {
      id: 'adl-katz',
      name: 'Activités de la vie quotidienne (ADL de Katz)',
      acronym: 'ADL',
      category: 'geriatrie',
      purpose:
        "Mesure l'autonomie pour les 6 activités de base de la vie quotidienne (toilette, habillage, WC, transferts, continence, alimentation).",
      aliases: ['adl', 'katz', 'activites vie quotidienne', 'autonomie de base'],
      keywords: ['autonomie', 'dépendance', 'personne âgée', 'toilette', 'habillage', 'transfert', 'continence', 'gériatrie'],
      fields: [
        adlItem('bathing', 'Hygiène corporelle (toilette / bain)'),
        adlItem('dressing', 'Habillage'),
        adlItem('toileting', 'Aller aux toilettes'),
        adlItem('transfer', 'Locomotion / transferts'),
        adlItem('continence', 'Continence'),
        adlItem('feeding', 'Alimentation'),
      ],
      reference: 'Katz 1963. Score 0–6 (6 = autonome).',
    },
    [
      { min: 0, level: 'high', label: 'Dépendance sévère', detail: 'Score 0–2 : dépendance sévère pour les activités de base.' },
      { min: 3, level: 'moderate', label: 'Dépendance partielle', detail: 'Score 3–5 : dépendance partielle.' },
      { min: 6, level: 'low', label: 'Autonome', detail: 'Score 6 : autonome pour toutes les activités de base.' },
    ],
  ),

  additiveScore(
    {
      id: 'iadl-4',
      name: 'Activités instrumentales (IADL simplifié, 4 items)',
      acronym: 'IADL-4',
      category: 'geriatrie',
      purpose:
        "Explore 4 activités instrumentales (téléphone, transports, médicaments, finances) : une perte d'autonomie oriente vers un dépistage cognitif.",
      aliases: ['iadl', 'lawton', 'iadl 4', 'activites instrumentales', 'barberger gateau'],
      keywords: ['autonomie', 'instrumentale', 'téléphone', 'médicaments', 'finances', 'transports', 'cognition', 'gériatrie'],
      fields: [
        iadlItem('phone', 'Utilisation du téléphone'),
        iadlItem('transport', 'Utilisation des moyens de transport'),
        iadlItem('medication', 'Prise des médicaments'),
        iadlItem('finances', 'Gestion des finances'),
      ],
      reference: 'Lawton 1969 / Barberger-Gateau 1992. Score 0–4 (0 = autonome).',
    },
    [
      { min: 0, level: 'low', label: 'Autonome', detail: 'Score 0 : autonomie instrumentale conservée sur les 4 items.' },
      { min: 1, level: 'moderate', label: 'Perte d’autonomie', detail: 'Score 1–2 : perte d’autonomie instrumentale — approfondir (dépistage cognitif).' },
      { min: 3, level: 'high', label: 'Dépendance marquée', detail: 'Score 3–4 : dépendance instrumentale marquée.' },
    ],
  ),

  {
    id: 'mmse',
    name: 'Mini-Mental State Examination (Folstein)',
    acronym: 'MMSE',
    category: 'geriatrie',
    purpose:
      "Évalue globalement les fonctions cognitives (/30) pour dépister et suivre un trouble neurocognitif.",
    aliases: ['mmse', 'folstein', 'mini mental', 'test cognitif'],
    keywords: ['cognition', 'démence', 'trouble neurocognitif', 'mémoire', 'Alzheimer', 'orientation', 'gériatrie', 'dépistage cognitif'],
    fields: [
      { kind: 'number', id: 'orientationTime', label: 'Orientation temporelle', unit: '/ 5', min: 0, max: 5, placeholder: '0–5' },
      { kind: 'number', id: 'orientationPlace', label: 'Orientation spatiale', unit: '/ 5', min: 0, max: 5, placeholder: '0–5' },
      { kind: 'number', id: 'registration', label: 'Apprentissage (3 mots)', unit: '/ 3', min: 0, max: 3, placeholder: '0–3' },
      { kind: 'number', id: 'attention', label: 'Attention et calcul (100 − 7 ou « monde »)', unit: '/ 5', min: 0, max: 5, placeholder: '0–5' },
      { kind: 'number', id: 'recall', label: 'Rappel des 3 mots', unit: '/ 3', min: 0, max: 3, placeholder: '0–3' },
      { kind: 'number', id: 'language', label: 'Langage et praxies constructives', unit: '/ 9', min: 0, max: 9, placeholder: '0–9' },
    ],
    reference: 'Folstein 1975. Score /30. Interpréter selon le niveau socio-culturel.',
    caution: 'Le seuil dépend du niveau d’études ; un MMSE normal n’exclut pas un trouble cognitif débutant.',
    compute: (v) => {
      const caps = { orientationTime: 5, orientationPlace: 5, registration: 3, attention: 5, recall: 3, language: 9 } as const;
      let total = 0;
      for (const [id, max] of Object.entries(caps)) {
        const x = v[id];
        if (!Number.isFinite(x)) return incompleteResult('Renseignez chaque sous-score du MMSE.');
        total += Math.min(Math.max(x, 0), max);
      }
      let interpretation: ScoreInterpretation;
      if (total >= 27) interpretation = { level: 'low', label: 'Normal', detail: 'Score ≥ 27/30 : performances cognitives normales.' };
      else if (total >= 24) interpretation = { level: 'moderate', label: 'Troubles légers', detail: 'Score 24–26/30 : troubles cognitifs légers possibles — à recouper avec la clinique.' };
      else if (total >= 18) interpretation = { level: 'high', label: 'Démence légère à modérée', detail: 'Score 18–23/30 : atteinte cognitive compatible avec une démence légère à modérée.' };
      else interpretation = { level: 'critical', label: 'Démence modérée à sévère', detail: 'Score < 18/30 : atteinte cognitive sévère.' };
      return { value: total, display: `${fmt(total)} / 30`, interpretation };
    },
  },

  {
    id: 'moca',
    name: 'Montreal Cognitive Assessment (MoCA)',
    acronym: 'MoCA',
    category: 'geriatrie',
    purpose:
      "Test cognitif plus sensible que le MMSE pour les troubles cognitifs légers (/30, + 1 point si ≤ 12 ans d'études).",
    aliases: ['moca', 'montreal cognitive assessment'],
    keywords: ['cognition', 'trouble cognitif léger', 'MCI', 'mémoire', 'démence', 'gériatrie', 'dépistage cognitif'],
    fields: [
      { kind: 'number', id: 'visuospatial', label: 'Visuospatial / exécutif', unit: '/ 5', min: 0, max: 5, placeholder: '0–5' },
      { kind: 'number', id: 'naming', label: 'Dénomination', unit: '/ 3', min: 0, max: 3, placeholder: '0–3' },
      { kind: 'number', id: 'attention', label: 'Attention', unit: '/ 6', min: 0, max: 6, placeholder: '0–6' },
      { kind: 'number', id: 'language', label: 'Langage', unit: '/ 3', min: 0, max: 3, placeholder: '0–3' },
      { kind: 'number', id: 'abstraction', label: 'Abstraction', unit: '/ 2', min: 0, max: 2, placeholder: '0–2' },
      { kind: 'number', id: 'recall', label: 'Rappel différé', unit: '/ 5', min: 0, max: 5, placeholder: '0–5' },
      { kind: 'number', id: 'orientation', label: 'Orientation', unit: '/ 6', min: 0, max: 6, placeholder: '0–6' },
      {
        kind: 'choice',
        id: 'education',
        label: 'Niveau d’études ≤ 12 ans',
        options: [
          { label: 'Non', value: 0 },
          { label: 'Oui (+1 point)', value: 1 },
        ],
      },
    ],
    reference: 'Nasreddine 2005. Score /30. Seuil de normalité : ≥ 26.',
    compute: (v) => {
      const caps = { visuospatial: 5, naming: 3, attention: 6, language: 3, abstraction: 2, recall: 5, orientation: 6 } as const;
      let total = 0;
      for (const [id, max] of Object.entries(caps)) {
        const x = v[id];
        if (!Number.isFinite(x)) return incompleteResult('Renseignez chaque sous-score du MoCA.');
        total += Math.min(Math.max(x, 0), max);
      }
      total = Math.min(30, total + (v.education === 1 ? 1 : 0));
      let interpretation: ScoreInterpretation;
      if (total >= 26) interpretation = { level: 'low', label: 'Normal', detail: 'Score ≥ 26/30 : performances cognitives normales.' };
      else if (total >= 18) interpretation = { level: 'moderate', label: 'Troubles légers', detail: 'Score 18–25/30 : trouble cognitif léger possible.' };
      else if (total >= 10) interpretation = { level: 'high', label: 'Troubles modérés', detail: 'Score 10–17/30 : atteinte cognitive modérée.' };
      else interpretation = { level: 'critical', label: 'Troubles sévères', detail: 'Score < 10/30 : atteinte cognitive sévère.' };
      return { value: total, display: `${fmt(total)} / 30`, interpretation };
    },
  },

  additiveScore(
    {
      id: 'mna-sf',
      name: 'Mini Nutritional Assessment — forme courte (MNA-SF)',
      acronym: 'MNA-SF',
      category: 'geriatrie',
      purpose:
        "Dépiste la dénutrition et le risque de dénutrition chez la personne âgée (6 items, /14).",
      aliases: ['mna', 'mna sf', 'mini nutritional assessment', 'depistage denutrition'],
      keywords: ['dénutrition', 'nutrition', 'perte de poids', 'appétit', 'personne âgée', 'malnutrition', 'gériatrie'],
      fields: [
        {
          kind: 'choice',
          id: 'appetite',
          label: 'Baisse des prises alimentaires (3 mois)',
          options: [
            { label: 'Sévère', value: 0 },
            { label: 'Modérée', value: 1 },
            { label: 'Pas de baisse', value: 2 },
          ],
        },
        {
          kind: 'choice',
          id: 'weightLoss',
          label: 'Perte de poids (3 mois)',
          options: [
            { label: '> 3 kg', value: 0 },
            { label: 'Ne sait pas', value: 1 },
            { label: '1 à 3 kg', value: 2 },
            { label: 'Pas de perte', value: 3 },
          ],
        },
        {
          kind: 'choice',
          id: 'mobility',
          label: 'Motricité',
          options: [
            { label: 'Du lit au fauteuil', value: 0 },
            { label: 'Autonome à l’intérieur', value: 1 },
            { label: 'Sort du domicile', value: 2 },
          ],
        },
        {
          kind: 'choice',
          id: 'stress',
          label: 'Maladie aiguë ou stress psychologique (3 mois)',
          options: [
            { label: 'Oui', value: 0 },
            { label: 'Non', value: 2 },
          ],
        },
        {
          kind: 'choice',
          id: 'neuro',
          label: 'Problèmes neuropsychologiques',
          options: [
            { label: 'Démence / dépression sévère', value: 0 },
            { label: 'Démence légère', value: 1 },
            { label: 'Pas de problème', value: 2 },
          ],
        },
        {
          kind: 'choice',
          id: 'bmi',
          label: 'Indice de masse corporelle',
          options: [
            { label: '< 19', value: 0 },
            { label: '19 à < 21', value: 1 },
            { label: '21 à < 23', value: 2 },
            { label: '≥ 23', value: 3 },
          ],
        },
      ],
      reference: 'Rubenstein 2001. Score 0–14.',
    },
    [
      { min: 0, level: 'high', label: 'Dénutrition', detail: 'Score 0–7 : dénutrition avérée — prise en charge nutritionnelle.' },
      { min: 8, level: 'moderate', label: 'Risque de dénutrition', detail: 'Score 8–11 : risque de dénutrition — surveillance et conseils.' },
      { min: 12, level: 'low', label: 'État nutritionnel normal', detail: 'Score 12–14 : état nutritionnel normal.' },
    ],
  ),

  {
    id: 'cam',
    name: 'Confusion Assessment Method (CAM)',
    acronym: 'CAM',
    category: 'geriatrie',
    purpose:
      "Repère un syndrome confusionnel (delirium) selon un algorithme : début aigu/fluctuant ET inattention, ET (pensée désorganisée OU vigilance altérée).",
    aliases: ['cam', 'confusion assessment method', 'delirium', 'syndrome confusionnel'],
    keywords: ['confusion', 'delirium', 'syndrome confusionnel', 'désorientation', 'vigilance', 'personne âgée', 'gériatrie'],
    fields: [
      yesNo('acuteFluctuating', '1. Début aigu ET évolution fluctuante', 1),
      yesNo('inattention', '2. Inattention', 1),
      yesNo('disorganized', '3. Pensée désorganisée', 1),
      yesNo('consciousness', '4. Altération de la vigilance', 1),
    ],
    reference: 'Inouye 1990. Positif si (1 ET 2) ET (3 OU 4).',
    compute: (v) => {
      const positive = v.acuteFluctuating === 1 && v.inattention === 1 && (v.disorganized === 1 || v.consciousness === 1);
      return {
        value: positive ? 1 : 0,
        display: positive ? 'Positif' : 'Négatif',
        interpretation: positive
          ? { level: 'high', label: 'Confusion probable', detail: 'Critères CAM réunis : syndrome confusionnel probable — rechercher un facteur déclenchant (médicament, infection, globe, fécalome…).' }
          : { level: 'low', label: 'Critères non réunis', detail: 'Les critères diagnostiques du delirium ne sont pas réunis.' },
      };
    },
  },

  additiveScore(
    {
      id: 'clinical-frailty',
      name: 'Échelle de fragilité clinique (Rockwood)',
      acronym: 'CFS',
      category: 'geriatrie',
      purpose:
        "Cote la fragilité globale sur une échelle de 1 (très en forme) à 9 (en phase terminale), à partir du jugement clinique.",
      aliases: ['cfs', 'clinical frailty scale', 'rockwood', 'fragilite clinique', 'echelle de fragilite'],
      keywords: ['fragilité', 'personne âgée', 'autonomie', 'pronostic', 'dépendance', 'gériatrie'],
      fields: [
        {
          kind: 'choice',
          id: 'level',
          label: 'Niveau de fragilité',
          options: [
            { label: '1 — Très en forme', value: 1 },
            { label: '2 — En forme', value: 2 },
            { label: '3 — Se maintient bien', value: 3 },
            { label: '4 — Vulnérable', value: 4 },
            { label: '5 — Fragilité légère', value: 5 },
            { label: '6 — Fragilité modérée', value: 6 },
            { label: '7 — Fragilité sévère', value: 7 },
            { label: '8 — Fragilité très sévère', value: 8 },
            { label: '9 — En phase terminale', value: 9 },
          ],
        },
      ],
      reference: 'Rockwood 2005. Fragilité à partir de 5.',
    },
    [
      { min: 1, level: 'low', label: 'Robuste', detail: 'Niveaux 1–3 : personne en forme ou se maintenant bien.' },
      { min: 4, level: 'moderate', label: 'Vulnérable', detail: 'Niveau 4 : vulnérable (ralenti, symptômes limitant les activités).' },
      { min: 5, level: 'high', label: 'Fragilité', detail: 'Niveaux 5–6 : fragilité légère à modérée — aide nécessaire pour certaines activités.' },
      { min: 7, level: 'critical', label: 'Fragilité sévère', detail: 'Niveaux 7–9 : fragilité sévère à terminale — forte dépendance.' },
    ],
    { format: (t) => `Niveau ${fmt(t)} / 9` },
  ),

  {
    id: 'timed-up-and-go',
    name: 'Timed Up and Go (TUG)',
    acronym: 'TUG',
    category: 'geriatrie',
    purpose:
      "Chronomètre le temps pour se lever, marcher 3 mètres, faire demi-tour et se rasseoir : dépiste le risque de chute.",
    aliases: ['timed up and go', 'tug', 'get up and go', 'risque de chute', 'test de marche'],
    keywords: ['chute', 'équilibre', 'marche', 'mobilité', 'personne âgée', 'risque de chute', 'gériatrie'],
    fields: [
      { kind: 'number', id: 'time', label: 'Temps réalisé', unit: 'secondes', min: 3, max: 120, step: 0.1, placeholder: 'ex. 14' },
    ],
    reference: 'Podsiadlo 1991. ≥ 14 s : risque de chute augmenté ; ≥ 20 s : mobilité fortement réduite.',
    compute: (v) => {
      const t = v.time;
      if (!Number.isFinite(t) || t <= 0) return incompleteResult('Renseignez le temps réalisé.');
      let interpretation: ScoreInterpretation;
      if (t < 12) interpretation = { level: 'low', label: 'Normal', detail: 'Temps < 12 s : mobilité normale, risque de chute faible.' };
      else if (t < 20) interpretation = { level: 'moderate', label: 'Risque de chute', detail: 'Temps 12–19 s : risque de chute augmenté (seuil d’alerte ~ 14 s).' };
      else interpretation = { level: 'high', label: 'Mobilité réduite', detail: 'Temps ≥ 20 s : mobilité fortement réduite — risque de chute élevé, évaluation approfondie.' };
      return { value: t, display: `${fmt(t, 1)} s`, interpretation };
    },
  },

  additiveScore(
    {
      id: 'braden',
      name: 'Échelle de Braden (risque d’escarre)',
      acronym: 'Braden',
      category: 'geriatrie',
      purpose:
        "Évalue le risque de survenue d'escarre (6 sous-échelles) pour déclencher les mesures de prévention.",
      aliases: ['braden', 'escarre', 'risque escarre', 'pression'],
      keywords: ['escarre', 'prévention', 'alitement', 'plaie de pression', 'immobilité', 'peau', 'gériatrie'],
      fields: [
        bradenItem('sensory', 'Perception sensorielle', ['Totalement limitée', 'Très limitée', 'Légèrement limitée', 'Aucune atteinte']),
        bradenItem('moisture', 'Humidité', ['Constamment humide', 'Souvent humide', 'Occasionnellement humide', 'Rarement humide']),
        bradenItem('activity', 'Activité', ['Alité', 'Au fauteuil', 'Marche occasionnellement', 'Marche fréquemment']),
        bradenItem('mobility', 'Mobilité', ['Totalement immobile', 'Très limitée', 'Légèrement limitée', 'Non limitée']),
        bradenItem('nutrition', 'Nutrition', ['Très pauvre', 'Probablement inadéquate', 'Correcte', 'Excellente']),
        {
          kind: 'choice',
          id: 'friction',
          label: 'Friction et cisaillement',
          options: [
            { label: 'Pas de problème apparent', value: 3 },
            { label: 'Problème potentiel', value: 2 },
            { label: 'Problème', value: 1 },
          ],
        },
      ],
      reference: 'Bergstrom 1987. Score 6–23 (plus bas = plus à risque).',
    },
    [
      { min: 6, level: 'critical', label: 'Risque très élevé', detail: 'Score ≤ 9 : risque très élevé d’escarre — prévention maximale.' },
      { min: 10, level: 'high', label: 'Risque élevé', detail: 'Score 10–12 : risque élevé.' },
      { min: 13, level: 'moderate', label: 'Risque modéré', detail: 'Score 13–14 : risque modéré.' },
      { min: 15, level: 'low', label: 'Risque faible', detail: 'Score 15–18 : risque faible (mais présent — rester vigilant).' },
      { min: 19, level: 'low', label: 'Risque minime', detail: 'Score ≥ 19 : risque minime.' },
    ],
  ),

  additiveScore(
    {
      id: 'charlson',
      name: 'Index de comorbidité de Charlson',
      acronym: 'Charlson',
      category: 'geriatrie',
      purpose:
        "Pondère les comorbidités (et l'âge) pour estimer le pronostic vital à moyen terme.",
      aliases: ['charlson', 'comorbidite', 'index de comorbidite', 'comorbidity index'],
      keywords: ['comorbidité', 'pronostic', 'mortalité', 'survie', 'personne âgée', 'polypathologie', 'gériatrie', 'oncogériatrie'],
      fields: [
        {
          kind: 'choice',
          id: 'age',
          label: 'Âge',
          options: [
            { label: '< 50 ans', value: 0 },
            { label: '50–59 ans', value: 1 },
            { label: '60–69 ans', value: 2 },
            { label: '70–79 ans', value: 3 },
            { label: '≥ 80 ans', value: 4 },
          ],
        },
        yesNo('mi', 'Infarctus du myocarde', 1),
        yesNo('chf', 'Insuffisance cardiaque', 1),
        yesNo('pvd', 'Artériopathie périphérique', 1),
        yesNo('cvd', 'Maladie cérébrovasculaire (AVC/AIT)', 1),
        yesNo('dementia', 'Démence', 1),
        yesNo('copd', 'BPCO / maladie pulmonaire chronique', 1),
        yesNo('ctd', 'Connectivite', 1),
        yesNo('ulcer', 'Ulcère gastroduodénal', 1),
        yesNo('mildLiver', 'Hépatopathie légère', 1),
        yesNo('diabetes', 'Diabète sans complication', 1),
        yesNo('hemiplegia', 'Hémiplégie', 2),
        yesNo('renal', 'Insuffisance rénale modérée à sévère', 2),
        yesNo('diabetesOrgan', 'Diabète avec atteinte d’organe', 2),
        yesNo('tumor', 'Tumeur solide (sans métastase)', 2),
        yesNo('leukemia', 'Leucémie', 2),
        yesNo('lymphoma', 'Lymphome', 2),
        yesNo('severeLiver', 'Hépatopathie modérée à sévère', 3),
        yesNo('metastasis', 'Tumeur solide métastatique', 6),
        yesNo('aids', 'SIDA', 6),
      ],
      reference: 'Charlson 1987. Un score plus élevé = pronostic vital plus réservé.',
    },
    [
      { min: 0, level: 'low', label: 'Comorbidité faible', detail: 'Score 0 : comorbidité faible (survie à 10 ans estimée élevée).' },
      { min: 1, level: 'moderate', label: 'Comorbidité modérée', detail: 'Score 1–2 : comorbidité modérée.' },
      { min: 3, level: 'high', label: 'Comorbidité élevée', detail: 'Score 3–4 : comorbidité élevée — pronostic à intégrer aux décisions.' },
      { min: 5, level: 'critical', label: 'Comorbidité très élevée', detail: 'Score ≥ 5 : comorbidité très élevée — pronostic vital réservé.' },
    ],
  ),
];

// ── Fabriques d'items répétitifs ────────────────────────────────────────────

function adlItem(id: string, label: string): ScoreDefinition['fields'][number] {
  return {
    kind: 'choice',
    id,
    label,
    options: [
      { label: 'Indépendant', value: 1 },
      { label: 'Dépendant', value: 0 },
    ],
  };
}

function iadlItem(id: string, label: string): ScoreDefinition['fields'][number] {
  return {
    kind: 'choice',
    id,
    label,
    options: [
      { label: 'Autonome', value: 0 },
      { label: 'Aide nécessaire / incapable', value: 1 },
    ],
  };
}

function bradenItem(id: string, label: string, labels: [string, string, string, string]): ScoreDefinition['fields'][number] {
  return {
    kind: 'choice',
    id,
    label,
    options: [
      { label: labels[3], value: 4 },
      { label: labels[2], value: 3 },
      { label: labels[1], value: 2 },
      { label: labels[0], value: 1 },
    ],
  };
}
