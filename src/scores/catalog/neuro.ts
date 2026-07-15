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
];
