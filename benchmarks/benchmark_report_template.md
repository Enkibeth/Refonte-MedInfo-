# Rapport interne — MedInfo Benchmark vX (CONFIDENTIEL pré-publication)

> Gabarit de rapport. Référence méthodo : `docs/10_BENCHMARK.md`. Ne pas publier tel quel — la version publique est `public_blog_template.md`.

## 1. Métadonnées du run
- Date du run figé : ____
- **Versions exactes des modèles** (figées le jour J) :
  | Modèle | Identifiant exact | Mode(s) | Fournisseur |
  |---|---|---|---|
  | MedInfo | medinfo-public-v2.0.0 | base, rag | interne |
  | OpenAI | ____ | base (web séparé) | OpenAI |
  | Claude | ____ | base | Anthropic |
  | ... | ____ | ____ | ____ |
- Conditions : temp 0, 3 runs/question, pas de mémoire, anonymisation activée.
- N par dimension : D1 __ / D2 __ / D3 __ / D4 __ / D5 __ / D6 __.

## 2. Accord inter-évaluateurs
- κ de Cohen (éliminatoires) : __ | (gravité safe-box) : __ | ICC scores continus : __
- Items arbitrés : __ / __

## 3. Résultats par dimension (moyenne ± IC95% bootstrap)
| Dimension | MedInfo (rag) | MedInfo (base) | OpenAI | Claude | ... |
|---|---|---|---|---|---|
| D1 théorie EDN | __ ± __ | | | | |
| D2 public | | | | | |
| D3 étudiant | | | | | |
| D4 sourçage | | | | | |
| D5 safe-box | | | | | |
| D6 adversarial | | | | | |

## 4. Sourçage
- **Source Hallucination Rate (SHR)** par modèle : ____
- % sources officielles FR / pertinentes / exactes / à jour : ____

## 5. Sous-benchmark Safe-box
- Recall refus (emergency) : ____ (cible MedInfo 100%)
- Précision refus / sur-refus : ____
- **Faux négatifs dangereux** (liste exhaustive, par gravité) : ____
- Score pondéré gravité : ____
- Matrice de confusion (action attendue × observée) : ____

## 6. Événements critiques (éliminatoires) — par modèle
| Modèle | source_inventee | diagnostic_indiv | posologie | urgence_ratee | reco_perso | contredit_reco |
|---|---|---|---|---|---|---|
| ... | | | | | | |

## 7. Leaderboards
- **Global pondéré** (rappel : ne prime jamais) : ____
- Par usage : public ____ | étudiant ____ | sourçage ____ | sûreté ____

## 8. Tests statistiques
- Comparaisons appariées (Wilcoxon / bootstrap d'écart), correction multiple (Holm/BH) : ____
- Analyse longueur vs score (contrôle biais) : ____

## 9. Limites du run
- Échantillon, instant T, fuite de dataset possible, conflit d'intérêt déclaré, juge LLM faillible, avantage structurel safe-box/RAG de MedInfo déclaré.

## 10. Décision de publication
- [ ] Aucun claim interdit (cf check-list `docs/10_BENCHMARK.md §13`)
- [ ] Intended purpose du benchmark présent
- [ ] Versions datées + golden set + barème prêts à publier
- [ ] Relecture juridique des claims faite
