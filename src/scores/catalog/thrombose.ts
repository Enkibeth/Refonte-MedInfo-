/**
 * Scores THROMBOSE / MALADIE VEINEUSE THROMBO-EMBOLIQUE.
 * Probabilité clinique de TVP/EP, gravité de l'EP, risque de MTEV, HIT.
 */
import { additiveScore, yesNo, type ScoreDefinition } from '../types';

export const THROMBOSE_SCORES: ScoreDefinition[] = [
  additiveScore(
    {
      id: 'wells-tvp',
      name: 'Score de Wells (thrombose veineuse profonde)',
      acronym: 'Wells TVP',
      category: 'thrombose',
      purpose:
        "Estime la probabilité clinique de thrombose veineuse profonde du membre inférieur avant D-dimères / échographie.",
      aliases: ['wells dvt', 'wells tvp', 'score de wells tvp'],
      keywords: [
        'thrombose veineuse profonde',
        'TVP',
        'phlébite',
        'jambe gonflée',
        'probabilité clinique',
        'd-dimères',
        'écho doppler',
      ],
      fields: [
        yesNo('cancer', 'Cancer actif (traitement < 6 mois ou palliatif)', 1),
        yesNo('paralysis', 'Paralysie / parésie ou immobilisation plâtrée récente', 1),
        yesNo('bedridden', 'Alitement > 3 j ou chirurgie majeure < 12 semaines', 1),
        yesNo('tenderness', 'Douleur sur le trajet veineux profond', 1),
        yesNo('legSwollen', 'Œdème de tout le membre', 1),
        yesNo('calf', 'Mollet augmenté > 3 cm vs côté sain', 1),
        yesNo('pitting', 'Œdème prenant le godet du côté symptomatique', 1),
        yesNo('collateral', 'Veines collatérales superficielles (non variqueuses)', 1),
        yesNo('previousDvt', 'ATCD de TVP documentée', 1),
        yesNo('altDiagnosis', 'Diagnostic alternatif au moins aussi probable', -2),
      ],
      reference: 'Wells 2003. Modèle à 3 niveaux. Dichotomisé : ≥ 2 = probable, < 2 = peu probable.',
    },
    [
      { min: -2, level: 'low', label: 'Probabilité faible', detail: 'Score ≤ 0 : prévalence de TVP ≈ 5 %. D-dimères recommandés.' },
      { min: 1, level: 'moderate', label: 'Probabilité intermédiaire', detail: 'Score 1–2 : prévalence ≈ 17 %.' },
      { min: 3, level: 'high', label: 'Probabilité forte', detail: 'Score ≥ 3 : prévalence ≈ 53 % — écho-doppler veineux.' },
    ],
  ),

  additiveScore(
    {
      id: 'wells-ep',
      name: 'Score de Wells (embolie pulmonaire)',
      acronym: 'Wells EP',
      category: 'thrombose',
      purpose:
        "Estime la probabilité clinique d'embolie pulmonaire pour orienter D-dimères vs angioscanner.",
      aliases: ['wells pe', 'wells ep', 'score de wells ep'],
      keywords: [
        'embolie pulmonaire',
        'EP',
        'dyspnée',
        'douleur thoracique',
        'probabilité clinique',
        'd-dimères',
        'angioscanner',
        'MTEV',
      ],
      fields: [
        yesNo('dvtSigns', 'Signes cliniques de TVP', 3),
        yesNo('peLikely', 'EP = diagnostic le plus probable', 3),
        yesNo('tachycardia', 'Fréquence cardiaque > 100/min', 1.5),
        yesNo('immobilization', 'Immobilisation ≥ 3 j ou chirurgie < 4 semaines', 1.5),
        yesNo('previousVte', 'ATCD de TVP ou EP', 1.5),
        yesNo('hemoptysis', 'Hémoptysie', 1),
        yesNo('malignancy', 'Cancer actif', 1),
      ],
      reference: 'Wells 2000. Dichotomisé : ≤ 4 = peu probable (→ D-dimères), > 4 = probable (→ angioscanner).',
    },
    [
      { min: 0, level: 'low', label: 'Probabilité faible', detail: 'Score < 2 : probabilité faible — D-dimères en première intention.' },
      { min: 2, level: 'moderate', label: 'Probabilité intermédiaire', detail: 'Score 2–6 : probabilité intermédiaire.' },
      { min: 6.5, level: 'high', label: 'Probabilité forte', detail: 'Score > 6 : probabilité forte — angioscanner sans attendre les D-dimères.' },
    ],
    { format: (t) => `${t.toString().replace('.', ',')} point${t > 1 ? 's' : ''}` },
  ),

  additiveScore(
    {
      id: 'geneve-ep',
      name: 'Score de Genève révisé (embolie pulmonaire)',
      acronym: 'Genève révisé',
      category: 'thrombose',
      purpose:
        "Alternative objective au score de Wells pour la probabilité clinique d'embolie pulmonaire (aucun jugement subjectif).",
      aliases: ['geneve', 'genève', 'geneva', 'score de geneve', 'geneve revise'],
      keywords: [
        'embolie pulmonaire',
        'EP',
        'probabilité clinique',
        'd-dimères',
        'angioscanner',
        'MTEV',
      ],
      fields: [
        yesNo('age', 'Âge > 65 ans', 1),
        yesNo('previousVte', 'ATCD de TVP ou EP', 3),
        yesNo('surgery', 'Chirurgie ou fracture < 1 mois', 2),
        yesNo('malignancy', 'Cancer actif (ou guéri < 1 an)', 2),
        yesNo('unilateralPain', 'Douleur unilatérale d’un membre inférieur', 3),
        yesNo('hemoptysis', 'Hémoptysie', 2),
        {
          kind: 'choice',
          id: 'heartRate',
          label: 'Fréquence cardiaque',
          options: [
            { label: '< 75/min', value: 0 },
            { label: '75–94/min', value: 3 },
            { label: '≥ 95/min', value: 5 },
          ],
        },
        yesNo('palpationEdema', 'Douleur à la palpation veineuse + œdème unilatéral', 4),
      ],
      reference: 'Le Gal 2006 (Genève révisé). Score 0–3 faible, 4–10 intermédiaire, ≥ 11 fort.',
    },
    [
      { min: 0, level: 'low', label: 'Probabilité faible', detail: 'Score 0–3 : probabilité faible.' },
      { min: 4, level: 'moderate', label: 'Probabilité intermédiaire', detail: 'Score 4–10 : probabilité intermédiaire.' },
      { min: 11, level: 'high', label: 'Probabilité forte', detail: 'Score ≥ 11 : probabilité forte.' },
    ],
  ),

  additiveScore(
    {
      id: 'pesi',
      name: 'Pulmonary Embolism Severity Index',
      acronym: 'PESI',
      category: 'thrombose',
      purpose:
        "Estime la mortalité à 30 jours d'une embolie pulmonaire confirmée et identifie les patients à faible risque (candidats à une prise en charge ambulatoire).",
      aliases: ['pesi', 'severity index embolie'],
      keywords: [
        'embolie pulmonaire',
        'EP',
        'gravité',
        'pronostic',
        'mortalité',
        'ambulatoire',
        'stratification',
      ],
      fields: [
        { kind: 'number', id: 'age', label: 'Âge', unit: 'ans (= points)', min: 0, max: 120, placeholder: 'ex. 68' },
        yesNo('male', 'Sexe masculin', 10),
        yesNo('cancer', 'Cancer', 30),
        yesNo('heartFailure', 'Insuffisance cardiaque chronique', 10),
        yesNo('lungDisease', 'Maladie pulmonaire chronique', 10),
        yesNo('tachycardia', 'Pouls ≥ 110/min', 20),
        yesNo('hypotension', 'PAS < 100 mmHg', 30),
        yesNo('tachypnea', 'Fréquence respiratoire ≥ 30/min', 20),
        yesNo('hypothermia', 'Température < 36 °C', 20),
        yesNo('mentalStatus', 'Altération de la conscience', 60),
        yesNo('hypoxia', 'SaO₂ < 90 %', 20),
      ],
      reference: 'Aujesky 2005. Classes I ≤ 65, II 66–85, III 86–105, IV 106–125, V > 125.',
    },
    [
      { min: 0, level: 'low', label: 'Classe I–II (faible)', detail: 'Score ≤ 85 : mortalité à 30 j faible (< 3,5 %) — ambulatoire envisageable.' },
      { min: 86, level: 'moderate', label: 'Classe III (intermédiaire)', detail: 'Score 86–105 : risque intermédiaire.' },
      { min: 106, level: 'high', label: 'Classe IV (élevé)', detail: 'Score 106–125 : risque élevé.' },
      { min: 126, level: 'critical', label: 'Classe V (très élevé)', detail: 'Score > 125 : mortalité à 30 j très élevée (jusqu’à ~ 25 %).' },
    ],
  ),

  additiveScore(
    {
      id: 'spesi',
      name: 'Simplified PESI',
      acronym: 'sPESI',
      category: 'thrombose',
      purpose:
        "Version simplifiée du PESI : identifie les embolies pulmonaires à faible risque (score 0) éligibles à une prise en charge ambulatoire.",
      aliases: ['spesi', 'pesi simplifie'],
      keywords: ['embolie pulmonaire', 'EP', 'gravité', 'pronostic', 'ambulatoire', 'mortalité'],
      fields: [
        yesNo('age', 'Âge > 80 ans', 1),
        yesNo('cancer', 'Cancer', 1),
        yesNo('cardiopulmonary', 'Insuffisance cardiaque OU respiratoire chronique', 1),
        yesNo('tachycardia', 'Pouls ≥ 110/min', 1),
        yesNo('hypotension', 'PAS < 100 mmHg', 1),
        yesNo('hypoxia', 'SaO₂ < 90 %', 1),
      ],
      reference: 'Jiménez 2010. Score 0 = faible risque.',
    },
    [
      { min: 0, level: 'low', label: 'Faible risque', detail: 'Score 0 : mortalité à 30 j ≈ 1 % — ambulatoire envisageable (si pas de dysfonction VD).' },
      { min: 1, level: 'high', label: 'Risque élevé', detail: 'Score ≥ 1 : mortalité à 30 j ≈ 11 % — hospitalisation.' },
    ],
  ),

  additiveScore(
    {
      id: 'padoue',
      name: 'Score de Padoue (risque de MTEV du patient médical hospitalisé)',
      acronym: 'Padoue',
      category: 'thrombose',
      purpose:
        "Évalue le risque de maladie thrombo-embolique veineuse chez le patient médical hospitalisé et l'indication de thromboprophylaxie.",
      aliases: ['padua', 'padoue', 'padua prediction score'],
      keywords: [
        'thromboprophylaxie',
        'MTEV',
        'thrombose',
        'patient hospitalisé',
        'prévention',
        'HBPM',
        'anticoagulation préventive',
      ],
      fields: [
        yesNo('cancer', 'Cancer actif', 3),
        yesNo('previousVte', 'ATCD de MTEV', 3),
        yesNo('mobility', 'Mobilité réduite (alitement ≥ 3 j)', 3),
        yesNo('thrombophilia', 'Thrombophilie connue', 3),
        yesNo('trauma', 'Traumatisme ou chirurgie ≤ 1 mois', 2),
        yesNo('age', 'Âge ≥ 70 ans', 1),
        yesNo('cardioResp', 'Insuffisance cardiaque ou respiratoire', 1),
        yesNo('miStroke', 'IDM ou AVC ischémique aigu', 1),
        yesNo('infection', 'Infection aiguë ou maladie rhumatologique', 1),
        yesNo('obesity', 'Obésité (IMC ≥ 30)', 1),
        yesNo('hormonal', 'Traitement hormonal en cours', 1),
      ],
      reference: 'Barbar 2010. Seuil : ≥ 4 = risque élevé.',
    },
    [
      { min: 0, level: 'low', label: 'Risque faible', detail: 'Score < 4 : thromboprophylaxie non systématique.' },
      { min: 4, level: 'high', label: 'Risque élevé', detail: 'Score ≥ 4 : thromboprophylaxie recommandée (sauf contre-indication).' },
    ],
  ),

  additiveScore(
    {
      id: '4t-hit',
      name: 'Score 4T (thrombopénie induite par l’héparine)',
      acronym: '4T',
      category: 'thrombose',
      purpose:
        "Estime la probabilité d'une thrombopénie induite par l'héparine (TIH/HIT) devant une chute des plaquettes sous héparine.",
      aliases: ['4t', 'score 4t', 'hit', 'tih', 'thrombopenie heparine'],
      keywords: [
        'thrombopénie',
        'héparine',
        'HIT',
        'TIH',
        'plaquettes',
        'anticoagulant',
        'thrombose sous héparine',
      ],
      fields: [
        {
          kind: 'choice',
          id: 'thrombocytopenia',
          label: 'Thrombopénie (amplitude de la chute)',
          options: [
            { label: 'Chute < 30 % ou nadir < 10 G/L', value: 0 },
            { label: 'Chute 30–50 % ou nadir 10–19 G/L', value: 1 },
            { label: 'Chute > 50 % et nadir ≥ 20 G/L', value: 2 },
          ],
        },
        {
          kind: 'choice',
          id: 'timing',
          label: 'Timing de la chute',
          options: [
            { label: '< 4 j sans exposition récente', value: 0 },
            { label: '> 10 j, ou incertain, ou ≤ 1 j (héparine 30–100 j avant)', value: 1 },
            { label: 'J5–J10, ou ≤ 1 j si héparine < 30 j avant', value: 2 },
          ],
        },
        {
          kind: 'choice',
          id: 'thrombosis',
          label: 'Thrombose / séquelles',
          options: [
            { label: 'Aucune', value: 0 },
            { label: 'Thrombose progressive/récidivante, lésions cutanées, suspicion', value: 1 },
            { label: 'Nouvelle thrombose, nécrose cutanée, réaction systémique aiguë', value: 2 },
          ],
        },
        {
          kind: 'choice',
          id: 'otherCause',
          label: 'Autre cause de thrombopénie',
          options: [
            { label: 'Cause certaine', value: 0 },
            { label: 'Cause possible', value: 1 },
            { label: 'Aucune autre cause apparente', value: 2 },
          ],
        },
      ],
      reference: 'Lo 2006. 0–3 faible, 4–5 intermédiaire, 6–8 fort.',
      caution: 'Un score faible (≤ 3) a une excellente valeur prédictive négative : la TIH est très peu probable.',
    },
    [
      { min: 0, level: 'low', label: 'Probabilité faible', detail: 'Score 0–3 : TIH très peu probable (poursuite de l’héparine possible).' },
      { min: 4, level: 'moderate', label: 'Probabilité intermédiaire', detail: 'Score 4–5 : doser les anticorps anti-PF4, envisager un relais.' },
      { min: 6, level: 'high', label: 'Probabilité forte', detail: 'Score 6–8 : arrêt de l’héparine + anticoagulant alternatif, sérologie anti-PF4.' },
    ],
  ),

  additiveScore(
    {
      id: 'perc',
      name: 'Règle PERC (exclusion d’embolie pulmonaire)',
      acronym: 'PERC',
      category: 'thrombose',
      purpose:
        "Chez un patient à faible probabilité clinique, permet d'écarter une embolie pulmonaire sans D-dimères si AUCUN des 8 critères n'est présent.",
      aliases: ['perc', 'perc rule', 'pulmonary embolism rule out'],
      keywords: ['embolie pulmonaire', 'EP', 'exclusion', 'd-dimères', 'faible probabilité', 'urgences', 'MTEV'],
      fields: [
        yesNo('age', 'Âge ≥ 50 ans', 1),
        yesNo('hr', 'Fréquence cardiaque ≥ 100/min', 1),
        yesNo('spo2', 'SaO₂ < 95 %', 1),
        yesNo('hemoptysis', 'Hémoptysie', 1),
        yesNo('estrogen', 'Prise d’œstrogènes', 1),
        yesNo('priorVte', 'ATCD de TVP / EP', 1),
        yesNo('legSwelling', 'Œdème unilatéral d’un membre inférieur', 1),
        yesNo('surgery', 'Chirurgie / traumatisme (< 4 semaines, avec hospitalisation)', 1),
      ],
      reference: 'Kline 2004. À n’utiliser que si la probabilité clinique est déjà FAIBLE.',
      caution: 'La règle PERC ne s’applique QUE lorsque la probabilité clinique pré-test est faible.',
    },
    [
      { min: 0, level: 'low', label: 'PERC négatif', detail: 'Aucun critère présent : embolie pulmonaire écartée sans D-dimères (si probabilité clinique faible).' },
      { min: 1, level: 'moderate', label: 'PERC positif', detail: 'Au moins un critère présent : la règle ne permet pas d’exclure — poursuivre par les D-dimères.' },
    ],
  ),
];
