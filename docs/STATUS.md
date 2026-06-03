# MedInfo AI — Statut projet

```yaml
title: Project Status
version: 1.0.0
owner: Hugo Bettembourg
status: Active
date: 2026-06-03
```

## État courant

- Étape 1 — scaffold : **terminée et poussée sur GitHub**.
- Commit de référence : `745a4f3f6d74964ecc19f60783f4aabfef01f692`.
- Branches présentes : `main`, `dev`, `staging`, toutes initialisées depuis le commit de l'étape 1.
- Architecture documentaire : organisée dans `docs/` avec ADRs dans `docs/DECISIONS/`.
- Workflow GitHub Actions : présent dans `.github/workflows/compliance.yml`.

## Validations locales effectuées

Les commandes suivantes ont été exécutées localement sur le scaffold étape 1 :

```bash
npm run typecheck
npm run test
npm run compliance
```

Résultat local : **OK**.

## Limite de vérification distante

Au moment de la vérification initiale, GitHub ne renvoyait pas encore de run GitHub Actions exploitable pour le commit `745a4f3f6d74964ecc19f60783f4aabfef01f692`.

Conséquence : l'étape 1 est validée par les contrôles locaux et par la présence distante des fichiers critiques, mais le premier statut CI GitHub Actions reste à confirmer lors d'un prochain push ou d'une prochaine pull request.

Cette limite ne bloque pas l'étape 2, mais elle doit être levée avant de considérer la chaîne CI distante comme prouvée.

## Étape 2 — classifieur d'intention : **implémentée (couche 1)**

Réalisée en TDD (tests de refus écrits avant la logique).

Critère minimal de validation — **atteint** :

```txt
"j'ai mal au ventre" → refus canonique `01_REGULATION.md §4`   ✅
LLM principal non appelé (garanti par runClassifierGate)       ✅
Tests de refus verts                                           ✅
```

Périmètre livré :

- Étage 1 regex déterministe local (`src/ai/classifier/`) : 5 catégories
  `general_info` / `personal_symptoms` / `emergency` / `out_of_scope` / `ambiguous`.
- Refus canonique (source unique `src/compliance/disclosures.ts`) pour
  `personal_symptoms` / `emergency` / `ambiguous`. `general_info` seul → LLM principal.
- Étage 2 (LLM léger) : interface injectable **non câblée** à cette étape (fail-safe `ambiguous`).
- Ceinture + bretelles : un verdict `general_info` de l'étage 2 est rétrogradé si un
  marqueur personnel regex subsiste.

Validations locales : `npm run typecheck`, `npm run test` (51 tests), `npm run compliance`
(5 gates) → **OK**.

Hors périmètre (reporté) : chat complet, RAG, auth, persistance Supabase
(`classifier_decisions`), étage 2 LLM réel, golden set 500 cas (07_CLASSIFIER §5).

## Étape suivante

Étape 3 — Auth Supabase + routing par persona + RLS testées (`02_ARCHITECTURE §4`, `03_SECURITY §2`).
Avant cela : expansion du golden set FR (calibration étage 2) déléguée à Codex.
