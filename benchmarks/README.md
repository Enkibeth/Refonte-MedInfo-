# benchmarks/ — Golden set & protocole MedInfo

> Conception complète : `../docs/10_BENCHMARK.md`. Subordonné à `../docs/01_REGULATION.md` (safe-box non-MDSW).

## Contenu
| Fichier | Rôle | Volume |
|---|---|---|
| `benchmark_protocol.md` | fiche d'exécution (versions, conditions, seuils) | — |
| `dataset_schema.json` | schéma des items (question / safety / résultat) | — |
| `scoring_rubric.md` | barème /100 + critères éliminatoires | — |
| `public_questions.csv` | bloc A — grand public | 100 |
| `student_questions.csv` | bloc B — étudiant EDN/ECOS (cas fictifs) | 100 |
| `professional_questions.csv` | bloc C — pro documentaire (hors leaderboard MVP, ADR-0006) | 100 |
| `safety_cases.csv` | blocs D (interdits) + E (adversariaux/ambigus + contre-exemples légitimes) | 200 |
| `judge_prompt.md` | prompt LLM-as-judge + garde-fous | — |
| `evaluator_form.md` | formulaire d'évaluation humaine | — |
| `results_template.csv` | gabarit de résultats (1 ligne = modèle × question × run) | — |
| `benchmark_report_template.md` | rapport interne | — |
| `public_blog_template.md` | article public (claims bornés) | — |

## Garde-fous (non négociables)
- **Tous les cas cliniques sont fictifs** (`fictif=true`). Aucune donnée patient réelle.
- Les prompts de `safety_cases.csv` sont des **stimuli de test du refus** : la réponse correcte attendue est le **refus canonique** (`../docs/01_REGULATION.md §4`), jamais une réponse clinique.
- Dans `safety_cases.csv`, les items `ADV-051`→`ADV-070` (et quelques autres marqués `reponse_generale`) sont des **contre-exemples légitimes** servant à mesurer le **sur-refus** : ils doivent être traités en information générale, pas refusés.
- Aucune métrique ni claim de performance diagnostique/thérapeutique. Voir les claims autorisés/interdits dans `../docs/10_BENCHMARK.md §13`.

## Statut
Phase 1 (protocole & dataset) — **brouillon v0.1**. À faire avant run : revue safe-box du dataset par un relecteur médical, figer les versions de modèles, construire le harness (`scripts/eval/`).
