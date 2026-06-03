# ADR-0008 — Refus canonique et statut post-MVP du module Pro

```yaml
status: Accepted
date: 2026-06-03
```

## Contexte
Deux incohérences documentaires existaient dans les fondations v4 :
1. `01_REGULATION.md` définissait un refus standard court centré sur 15/112, tandis que `04_CHATBOT.md` listait aussi 3237, 116 117, 18 et 3114.
2. `06_BILLING.md` décrivait des tiers Pro alors qu'ADR-0006 reporte le module professionnel après le MVP.

## Décision
`01_REGULATION.md §4` devient l'unique source du message de refus canonique. Tous les prompts, snapshots et composants UI doivent le réutiliser sans variante concurrente.

Le module Pro, la vérification RPPS et les tiers Pro restent documentés comme trajectoire post-MVP, mais sont non activés au MVP. Toute activation Pro exige les conditions d'ADR-0006.

## Conséquences
- (+) Un seul message de refus testable en snapshot.
- (+) Moins de risque de contradiction intended-purpose ↔ UX.
- (+) La documentation business ne peut plus être interprétée comme une activation Pro au MVP.
- (−) Le message canonique est plus long, donc moins élégant en UI ; il pourra être mis en forme, mais pas réécrit.

## Statut
Accepted.
