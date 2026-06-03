# ADR-0006 — Report du module professionnel après le MVP

```yaml
status: Accepted
date: 2026-06-02
```

## Contexte
Même reformulé en « référence documentaire », le module pro reste l'angle MDSW le plus exposé : un clinicien l'interroge avec un patient en tête (intended use réel observable). La Rev.1 du MDCG (juin 2025) durcit la frontière (prédiction/pronostic).

## Décision
MVP = public + student uniquement. Module pro reporté à M6-M9, conditionné à : (1) avis GIO ANSM écrit, (2) note de qualification interne, (3) RCP pro souscrite, (4) télémétrie de conformité (taux de refus/reframing) + golden eval set adversarial.

## Conséquences
- (+) Réduit drastiquement le risque réglementaire au lancement.
- (−) Reporte ~60% de la valeur commerciale (les pros paient, le public peu).
- professional.v2.ts existe dans le repo mais N'EST PAS activé (référencé dans 04_CHATBOT §7).

## Statut
Accepted.
