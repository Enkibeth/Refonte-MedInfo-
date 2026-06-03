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

## Étape suivante

Étape 2 — classifieur d'intention : **non implémentée**.

Critère minimal de validation attendu :

```txt
"j'ai mal au ventre" → refus canonique `01_REGULATION.md §4`
LLM principal non appelé
Tests de refus verts
```

L'étape 2 doit commencer par les tests de refus en TDD avant toute logique de classification.
