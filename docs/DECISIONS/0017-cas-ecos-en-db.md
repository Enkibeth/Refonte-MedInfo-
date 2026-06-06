# ADR-0017 — Cas ECOS pédagogiques en base

```yaml
status: Accepted
date: 2026-06-06
owner: Hugo Bettembourg
linked_to: [04_CHATBOT §student, 01_REGULATION §1 §4 §5, ADR-0003, ADR-0011]
```

## Contexte
Le persona étudiant autorise les cas explicitement fictifs EDN/R2C/ECOS, mais pas les cas de patients
réels même anonymisés. Pour générer des stations ECOS cohérentes, versionnées et auditables, les cas
ne doivent pas être dispersés dans les prompts ou saisis librement comme contenu clinique réel.

## Décision
Les cas ECOS sont stockés en base comme **contenus pédagogiques synthétiques et versionnés** : titre,
objectifs, consignes, données de station, grille d'évaluation et métadonnées pédagogiques. Toute entrée
doit porter un marqueur explicite de fiction/pédagogie. Les cas réels, même anonymisés, sont interdits
hors procédure HDS + ADR dédiée.

## Conséquences
- Améliore la maintenabilité : mêmes cas pour UI, tests, évaluation et prompts.
- Facilite l'audit qualité et la suppression d'un cas problématique.
- Impose une séparation stricte entre corpus pédagogique ECOS et toute donnée patient.

## Rollback
Désactiver la surface ECOS et conserver les cas comme contenu dormant, ou supprimer les tables de cas
si aucun exercice étudiant n'est encore servi. Le chat public/student reste inchangé.
