# ADR-0015 — Classifieur étage 2 : décision runtime fail-closed

```yaml
status: Accepted
date: 2026-06-06
owner: Hugo Bettembourg
linked_to: [07_CLASSIFIER §2 §3 §4, ADR-0013, ADR-0003]
```

## Contexte
ADR-0013 a acté le câblage de l'étage 2 avec Claude Haiku 4.5. La décision structurante restante
est l'exploitation runtime : l'étage 2 améliore le rappel des questions générales, mais il ne doit
jamais devenir une porte d'entrée vers du triage, du diagnostic ou une CAT individualisée.

## Décision
L'étage 2 est un **routeur sémantique**, pas un assistant médical. Il ne s'exécute que si l'étage 1
regex/lexique ne tranche pas, produit un verdict typé avec `temperature=0`, et doit échouer en
`ambiguous` dès qu'un appel LLM, un quota, un JSON ou une confiance est invalide. Un verdict
`general_info` reste soumis aux garde-fous déterministes (`confidence >= 0,85`, rétrogradation si
marqueur personnel) avant d'autoriser le LLM principal.

## Conséquences
- Réduit le sur-refus sur les questions générales légitimes sans affaiblir la safe-box.
- Ajoute une dépendance de latence/coût uniquement sur les messages non tranchés.
- Ferme l'option d'un étage 2 « permissif » : tout doute reste un refus canonique.

## Rollback
Désactiver `CLASSIFIER_STAGE2_ENABLED` ou retirer la clé du provider. Le système revient au regex seul
+ fail-safe `ambiguous`, sans changement de schéma.
