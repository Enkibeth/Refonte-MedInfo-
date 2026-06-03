# CHANGELOG_AI

Journal des modifications par agents IA. Une entrée par PR.

## Format
```
## [DATE] – <Agent>
### Files modified
- ...
### Purpose
...
### Regulatory impact
None | Potential | Confirmed
### Rollback plan
...
```

---

## [2026-06-02] – Claude (foundation)
### Files modified
- docs/00_CHARTER.md, 01_REGULATION.md, 02_ARCHITECTURE.md, 03_SECURITY.md,
  04_CHATBOT.md, 05_DESIGN.md, 06_BILLING.md, README.md, CHANGELOG_AI.md
- docs/DECISIONS/0001-template.md, 0002, 0003
- .ai-governance.md, .github/workflows/compliance.yml (stubs)
### Purpose
Pose des fondations documentaires v4 (regulatory-first, executable-compliance).
### Regulatory impact
None (documentation seule, aucune feature).
### Rollback plan
git revert du commit initial.

## [2026-06-02] – Claude (consolidation v2)
### Files modified
- docs/04_CHATBOT.md → v2.0.0 (suppression triage/recueil, tool-calling natif, pro reporté)
- docs/07_CLASSIFIER.md (nouveau — spec classifieur d'intention)
- docs/08_RAG.md (nouveau — pipeline RAG, corpus FR, grounding)
- docs/06_BILLING.md → +§10 (vérif statut RPPS/étudiant)
- docs/README.md (index mis à jour)
- docs/DECISIONS/0005, 0006, 0007 (prompts v2, report pro, vérif RPPS)
- START.md (nouveau — point d'entrée + ordre d'exécution step-by-step)
### Purpose
Consolider les décisions des rapports de recherche dans le repo. Réconcilier la contradiction v1/v2 sur les prompts. Repo désormais cohérent et pilotable par agent.
### Regulatory impact
Confirmed (positif) : alignement complet sur la safe-box non-MDSW, report du module pro.
### Rollback plan
git revert du commit de consolidation.

## [2026-06-03] – GPT-5.5 Thinking (harmonisation + scaffold étape 1)
### Files modified
- docs/01_REGULATION.md, 02_ARCHITECTURE.md, 03_SECURITY.md, 04_CHATBOT.md, 06_BILLING.md
- docs/DECISIONS/0008-refus-canonique-et-pro-post-mvp.md
- README.md, package.json, app.json, tsconfig.json, expo-env.d.ts
- app/, src/, supabase/, scripts/, tests/
- .github/workflows/compliance.yml
### Purpose
Harmoniser les contradictions documentaires repérées : message de refus unique et statut post-MVP non activé du module Pro. Créer le scaffold Expo/Supabase/Vercel AI SDK conforme à l'étape 1.
### Regulatory impact
Confirmed (positif) : réduction des contradictions autour de la safe-box et verrouillage explicite du Pro hors MVP.
### Rollback plan
git revert de la PR/branche `ai/gpt-5.5/etape-1-scaffold` ou restauration de l'archive fondatrice.

## [2026-06-03] – GPT-5.5 Thinking (statut projet + branches)
### Files modified
- docs/STATUS.md
- docs/README.md
- docs/CHANGELOG_AI.md
- branches GitHub `dev` et `staging` créées depuis le commit de l'étape 1
### Purpose
Documenter la limite réelle de vérification distante : aucun run GitHub Actions exploitable observé au moment du contrôle initial. Corriger le statut des branches : `main`, `dev` et `staging` existent désormais.
### Regulatory impact
None (documentation et hygiène repo uniquement).
### Rollback plan
git revert des commits documentaires et suppression manuelle éventuelle des branches si nécessaire.

## [2026-06-03] – GPT-5.3-Codex (golden set classifieur FR)
### Files modified
- tests/classifier/golden/golden-set.fr.jsonl
- scripts/eval/classifier-goldenset.mjs
- package.json
- docs/CHANGELOG_AI.md
### Purpose
Ajouter un golden set synthétique français de calibration du classifieur d'intention et un harnais d'évaluation regex/fail-safe sans appel LLM réel.
### Regulatory impact
Confirmed (positif) : support de calibration pour réduire les faux négatifs `personal_symptoms`/`emergency` sans introduire de logique de triage ou diagnostic.
### Rollback plan
git revert du commit d'ajout du golden set et du script `eval:classifier`.
