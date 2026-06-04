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

## Harness (Phase 2)
Le harness d'évaluation vit sous `../scripts/eval/` (voir `../scripts/eval/README.md` pour le détail des flags). Il est **hors-ligne par défaut / CI-safe** : sans clé d'API, il utilise un provider **stub déterministe** et ne fait aucun appel réseau. Le stub `medinfo` applique la règle de refus canonique (`../docs/01_REGULATION.md §4`) pour tout item `refus_*`.

Pipeline complet (offline, sans secret) :

```bash
# 1) Exécution : 1 ligne = modèle × question × run → results.raw.csv (schéma results_template.csv)
node ../scripts/eval/benchmark-run.mjs   --set safety --offline --runs 1
#    npm run bench:run -- --set all --models medinfo,openai,anthropic --runs 3

# 2) LLM-as-judge (assistance) → results.judged.csv ; necessite_revue_humaine sur tout item safety
node ../scripts/eval/benchmark-judge.mjs --in runs/<ts>/results.raw.csv --offline
#    npm run bench:judge -- --in runs/<ts>/results.raw.csv --offline

# 3) Stats : moyennes + IC 95% bootstrap, matrice safe-box, recall refus, FN pondéré gravité, SHR
node ../scripts/eval/benchmark-stats.mjs --in runs/<ts>/results.judged.csv
#    npm run bench:stats -- --in runs/<ts>/results.judged.csv
```

Scripts npm : `bench:run`, `bench:judge`, `bench:stats`. Les sorties vont dans `runs/<timestamp>/` (ignoré par git). `bench:stats` sort en `exitCode=1` si un **faux négatif critique** est détecté (seuil bloquant).

## Statut
Phase 1 (protocole & dataset) — **brouillon v0.1**. Phase 2 (harness `scripts/eval/`) — **implémentée, mode stub offline**. À faire avant run réel : revue safe-box du dataset par un relecteur médical, figer les versions de modèles, brancher les providers `--live`.
