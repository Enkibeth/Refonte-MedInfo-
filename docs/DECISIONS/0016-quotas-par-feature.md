# ADR-0016 — Quotas par feature, découplés des sources

```yaml
status: Accepted
date: 2026-06-06
owner: Hugo Bettembourg
linked_to: [06_BILLING §1 §5, 03_SECURITY §3, ADR-0012]
```

## Contexte
Le rate-limit initial est centré sur le chat. Les nouvelles surfaces IA (transcription, ECOS,
exports, futures features étudiantes) ont des coûts et risques différents. Un quota global unique
force soit à surbloquer, soit à laisser une feature coûteuse consommer tout le budget.

## Décision
Les quotas sont suivis **par feature** (`chat`, `transcription`, `ecos`, `export`, etc.) et résolus
côté serveur à partir du profil vérifié + entitlement Stripe + configuration runtime. Les compteurs
restent techniques, sans contenu de message, et accessibles uniquement via service role. Le paywall
continue de ne porter que sur le volume et les features avancées : il ne bloque jamais les sources
HAS/ANSM ni les refus de sécurité.

## Conséquences
- Permet une matrice d'offres lisible et réversible sans toucher aux prompts.
- Réduit le risque coût/abus par surface IA.
- Nécessite des tests RLS et des tests d'entitlements pour chaque nouvelle feature quotée.

## Rollback
Revenir au quota chat unique en ignorant les clés de feature dans la résolution serveur. Les compteurs
existants peuvent rester en base comme historique technique non médical.
