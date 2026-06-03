# ADR-0007 — Vérification de statut : Annuaire Santé FHIR + allowlist étudiants

```yaml
status: Accepted
date: 2026-06-02
```

## Contexte
Le gating par audience exige de vérifier le statut étudiant et professionnel. Options évaluées : SheerID (cher), API Statut étudiant DINUM (réservée administrations), Pro Santé Connect (exige HDS), API FHIR Annuaire Santé ANS.

## Décision
Étudiants : allowlist ~40 domaines `.fr` + magic link + fallback upload manuel (suppression 7 j). Professionnels : API FHIR Annuaire Santé (gratuite, GRAVITEE-API-KEY, lookup RPPS) + cross-check nom. Pro Santé Connect reporté en v2 (exige HDS, hors budget MVP).

## Conséquences
- (+) Coût 0 €, intégrable en ~3 jours, couvre internes (RPPS via CPF) ET seniors.
- (−) Allowlist étudiant tolère une fraude résiduelle (acceptable, unit economics faibles).
- PSC obligatoire seulement si traitement de données patient identifiantes → pas au MVP.

## Statut
Accepted.
