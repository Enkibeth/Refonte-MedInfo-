/**
 * Scores NEUROLOGIE.
 * Risque d'AVC après AIT (ABCD²), sévérité de l'AVC constitué (NIHSS).
 */
import { additiveScore, yesNo, type ScoreDefinition, type ScoreOption } from '../types';

/** Item NIHSS = un champ « choix » 0..n avec libellés fournis. */
function nihssItem(id: string, label: string, options: [string, number][]): ScoreDefinition['fields'][number] {
  return { kind: 'choice', id, label, options: options.map(([l, value]) => ({ label: l, value }) as ScoreOption) };
}

export const NEURO_SCORES: ScoreDefinition[] = [
  additiveScore(
    {
      id: 'abcd2',
      name: 'Score ABCD² (risque d’AVC après un AIT)',
      acronym: 'ABCD²',
      category: 'neuro',
      purpose:
        "Estime le risque d'AVC constitué dans les jours suivant un accident ischémique transitoire et aide à décider de l'urgence de la prise en charge.",
      aliases: ['abcd2', 'abcd²', 'abcd', 'score ait'],
      keywords: [
        'AIT',
        'accident ischémique transitoire',
        'AVC',
        'risque',
        'neurologie',
        'déficit transitoire',
      ],
      fields: [
        yesNo('age', 'Âge ≥ 60 ans', 1),
        yesNo('bp', 'PA ≥ 140/90 mmHg', 1),
        {
          kind: 'choice',
          id: 'clinical',
          label: 'Signes cliniques',
          options: [
            { label: 'Autres', value: 0 },
            { label: 'Trouble de la parole sans déficit moteur', value: 1 },
            { label: 'Déficit moteur unilatéral', value: 2 },
          ],
        },
        {
          kind: 'choice',
          id: 'duration',
          label: 'Durée des symptômes',
          options: [
            { label: '< 10 min', value: 0 },
            { label: '10–59 min', value: 1 },
            { label: '≥ 60 min', value: 2 },
          ],
        },
        yesNo('diabetes', 'Diabète', 1),
      ],
      reference: 'Johnston 2007. 0–3 faible, 4–5 modéré, 6–7 élevé.',
      caution: 'Tout AIT est une urgence : l’ABCD² ne doit pas retarder le bilan (imagerie, avis neurovasculaire).',
    },
    [
      { min: 0, level: 'low', label: 'Risque faible', detail: 'Score 0–3 : risque d’AVC à 2 j ≈ 1 %.' },
      { min: 4, level: 'moderate', label: 'Risque modéré', detail: 'Score 4–5 : risque d’AVC à 2 j ≈ 4 % — bilan hospitalier rapide.' },
      { min: 6, level: 'high', label: 'Risque élevé', detail: 'Score 6–7 : risque d’AVC à 2 j ≈ 8 % — hospitalisation urgente.' },
    ],
  ),

  additiveScore(
    {
      id: 'nihss',
      name: 'National Institutes of Health Stroke Scale',
      acronym: 'NIHSS',
      category: 'neuro',
      purpose:
        "Quantifie la sévérité d'un AVC constitué (15 items) — décision de thrombolyse/thrombectomie et suivi de l'évolution.",
      aliases: ['nihss', 'nih stroke scale', 'score avc', 'echelle avc'],
      keywords: [
        'AVC',
        'accident vasculaire cérébral',
        'thrombolyse',
        'thrombectomie',
        'déficit neurologique',
        'sévérité',
        'neurologie',
      ],
      fields: [
        nihssItem('loc', '1a. Niveau de conscience', [
          ['Vigilant', 0],
          ['Somnolent (réveil facile)', 1],
          ['Stuporeux (réveil difficile)', 2],
          ['Coma', 3],
        ]),
        nihssItem('locQuestions', '1b. Questions LOC (mois, âge)', [
          ['Deux réponses justes', 0],
          ['Une réponse juste', 1],
          ['Aucune réponse juste', 2],
        ]),
        nihssItem('locCommands', '1c. Commandes LOC (yeux, main)', [
          ['Deux ordres exécutés', 0],
          ['Un ordre exécuté', 1],
          ['Aucun ordre exécuté', 2],
        ]),
        nihssItem('gaze', '2. Oculomotricité', [
          ['Normale', 0],
          ['Paralysie partielle du regard', 1],
          ['Déviation forcée', 2],
        ]),
        nihssItem('visual', '3. Champ visuel', [
          ['Normal', 0],
          ['Quadranopsie', 1],
          ['Hémianopsie', 2],
          ['Hémianopsie bilatérale / cécité', 3],
        ]),
        nihssItem('facial', '4. Paralysie faciale', [
          ['Normale', 0],
          ['Mineure', 1],
          ['Partielle', 2],
          ['Complète', 3],
        ]),
        nihssItem('armLeft', '5a. Motricité — membre supérieur gauche', [
          ['Pas de chute (10 s)', 0],
          ['Chute avant 10 s', 1],
          ['Effort contre pesanteur', 2],
          ['Pas d’effort contre pesanteur', 3],
          ['Aucun mouvement', 4],
        ]),
        nihssItem('armRight', '5b. Motricité — membre supérieur droit', [
          ['Pas de chute (10 s)', 0],
          ['Chute avant 10 s', 1],
          ['Effort contre pesanteur', 2],
          ['Pas d’effort contre pesanteur', 3],
          ['Aucun mouvement', 4],
        ]),
        nihssItem('legLeft', '6a. Motricité — membre inférieur gauche', [
          ['Pas de chute (5 s)', 0],
          ['Chute avant 5 s', 1],
          ['Effort contre pesanteur', 2],
          ['Pas d’effort contre pesanteur', 3],
          ['Aucun mouvement', 4],
        ]),
        nihssItem('legRight', '6b. Motricité — membre inférieur droit', [
          ['Pas de chute (5 s)', 0],
          ['Chute avant 5 s', 1],
          ['Effort contre pesanteur', 2],
          ['Pas d’effort contre pesanteur', 3],
          ['Aucun mouvement', 4],
        ]),
        nihssItem('ataxia', '7. Ataxie des membres', [
          ['Absente', 0],
          ['Un membre', 1],
          ['Deux membres', 2],
        ]),
        nihssItem('sensory', '8. Sensibilité', [
          ['Normale', 0],
          ['Déficit léger à modéré', 1],
          ['Déficit sévère à anesthésie', 2],
        ]),
        nihssItem('language', '9. Langage', [
          ['Normal', 0],
          ['Aphasie légère à modérée', 1],
          ['Aphasie sévère', 2],
          ['Mutisme / aphasie globale', 3],
        ]),
        nihssItem('dysarthria', '10. Dysarthrie', [
          ['Normale', 0],
          ['Légère à modérée', 1],
          ['Sévère (inintelligible)', 2],
        ]),
        nihssItem('extinction', '11. Extinction / négligence', [
          ['Absente', 0],
          ['Une modalité négligée', 1],
          ['Héminégligence sévère (≥ 2 modalités)', 2],
        ]),
      ],
      reference: 'Brott 1989. Score 0–42.',
    },
    [
      { min: 0, level: 'low', label: 'Déficit absent à mineur', detail: 'Score 0–4 : AVC mineur (0 = pas de déficit détectable).' },
      { min: 5, level: 'moderate', label: 'AVC modéré', detail: 'Score 5–15 : AVC modéré.' },
      { min: 16, level: 'high', label: 'AVC modéré à sévère', detail: 'Score 16–20 : AVC modérément sévère.' },
      { min: 21, level: 'critical', label: 'AVC sévère', detail: 'Score 21–42 : AVC sévère.' },
    ],
  ),

  additiveScore(
    {
      id: 'hunt-hess',
      name: 'Classification de Hunt et Hess (hémorragie sous-arachnoïdienne)',
      acronym: 'Hunt & Hess',
      category: 'neuro',
      purpose:
        "Cote la sévérité clinique d'une hémorragie méningée (rupture d'anévrisme) et son pronostic.",
      aliases: ['hunt hess', 'hunt et hess', 'hemorragie meningee', 'hemorragie sous arachnoidienne'],
      keywords: ['hémorragie méningée', 'hémorragie sous-arachnoïdienne', 'anévrisme', 'céphalée brutale', 'neurochirurgie', 'pronostic'],
      fields: [
        {
          kind: 'choice',
          id: 'grade',
          label: 'Tableau clinique',
          options: [
            { label: 'I — Asymptomatique ou céphalée minime', value: 1 },
            { label: 'II — Céphalée sévère, raideur de nuque, sans déficit (hors paralysie de nerf crânien)', value: 2 },
            { label: 'III — Somnolence, confusion, déficit focal léger', value: 3 },
            { label: 'IV — Stupeur, hémiparésie modérée à sévère', value: 4 },
            { label: 'V — Coma, rigidité de décérébration', value: 5 },
          ],
        },
      ],
      reference: 'Hunt & Hess 1968. Grades I–V (pronostic péjoratif croissant).',
    },
    [
      { min: 1, level: 'low', label: 'Grade I', detail: 'Asymptomatique ou céphalée minime — bon pronostic.' },
      { min: 2, level: 'moderate', label: 'Grade II', detail: 'Céphalée sévère et raideur méningée sans déficit.' },
      { min: 3, level: 'high', label: 'Grade III', detail: 'Troubles de vigilance, déficit focal léger.' },
      { min: 4, level: 'critical', label: 'Grade IV–V', detail: 'Stupeur/coma, déficit sévère — pronostic réservé.' },
    ],
    { format: (t) => `Grade ${['I', 'II', 'III', 'IV', 'V'][t - 1] ?? t}` },
  ),

  additiveScore(
    {
      id: 'rankin',
      name: 'Échelle de Rankin modifiée (mRS)',
      acronym: 'mRS',
      category: 'neuro',
      purpose:
        "Mesure le handicap fonctionnel global après un AVC (0 = aucun symptôme, 6 = décès).",
      aliases: ['rankin', 'mrs', 'modified rankin', 'handicap avc', 'echelle de rankin'],
      keywords: ['AVC', 'handicap', 'autonomie', 'pronostic fonctionnel', 'séquelles', 'neurologie'],
      fields: [
        {
          kind: 'choice',
          id: 'grade',
          label: 'Niveau de handicap',
          options: [
            { label: '0 — Aucun symptôme', value: 0 },
            { label: '1 — Pas de handicap significatif malgré des symptômes', value: 1 },
            { label: '2 — Handicap léger (autonome mais activités antérieures réduites)', value: 2 },
            { label: '3 — Handicap modéré (aide nécessaire, marche seul)', value: 3 },
            { label: '4 — Handicap modérément sévère (ne marche/ne subvient pas sans aide)', value: 4 },
            { label: '5 — Handicap sévère (alité, incontinent, soins constants)', value: 5 },
            { label: '6 — Décès', value: 6 },
          ],
        },
      ],
      reference: 'Rankin 1957 / van Swieten 1988. Score 0–6.',
    },
    [
      { min: 0, level: 'low', label: 'Handicap absent à léger', detail: 'mRS 0–2 : autonomie conservée.' },
      { min: 3, level: 'high', label: 'Handicap modéré à sévère', detail: 'mRS 3–5 : perte d’autonomie, aide nécessaire.' },
      { min: 6, level: 'critical', label: 'Décès', detail: 'mRS 6.' },
    ],
    { format: (t) => `mRS ${fmtGrade(t)}` },
  ),

  additiveScore(
    {
      id: 'ich-score',
      name: 'ICH Score (hémorragie intracérébrale)',
      acronym: 'ICH',
      category: 'neuro',
      purpose:
        "Estime la mortalité à 30 jours d'une hémorragie intraparenchymateuse spontanée.",
      aliases: ['ich', 'ich score', 'hemorragie intracerebrale', 'hematome intraparenchymateux'],
      keywords: ['hémorragie cérébrale', 'hématome', 'AVC hémorragique', 'pronostic', 'mortalité', 'neurologie'],
      fields: [
        {
          kind: 'choice',
          id: 'gcs',
          label: 'Score de Glasgow',
          options: [
            { label: '13–15', value: 0 },
            { label: '5–12', value: 1 },
            { label: '3–4', value: 2 },
          ],
        },
        yesNo('volume', 'Volume de l’hématome ≥ 30 cm³', 1),
        yesNo('ivh', 'Hémorragie intraventriculaire', 1),
        yesNo('infratentorial', 'Origine infratentorielle', 1),
        yesNo('age', 'Âge ≥ 80 ans', 1),
      ],
      reference: 'Hemphill 2001. Score 0–6 ; la mortalité à 30 j croît fortement avec le score.',
    },
    [
      { min: 0, level: 'low', label: 'Mortalité faible', detail: 'Score 0–1 : mortalité à 30 j ≈ 0–13 %.' },
      { min: 2, level: 'high', label: 'Mortalité élevée', detail: 'Score 2–3 : mortalité à 30 j ≈ 26–72 %.' },
      { min: 4, level: 'critical', label: 'Mortalité très élevée', detail: 'Score ≥ 4 : mortalité à 30 j ≈ 97–100 %.' },
    ],
  ),
];

function fmtGrade(t: number): string {
  return Number.isFinite(t) ? String(Math.round(t)) : '—';
}
