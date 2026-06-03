# ADR-0003 — Doctrine safe-box non-MDSW

```yaml
status: Accepted
date: 2026-06-02
```

## Contexte
Marquage CE Classe IIa (MDR 2017/745) = 80 000-300 000 € + 12-18 mois, incompatible avec budget/délai. Profile wizard, calculateurs cliniques, triage symptomatique, interaction médicamenteuse avec avis = déclencheurs MDSW.

## Décision
Rester strictement hors MDSW. Suppression définitive du profile wizard et des calculateurs interprétatifs. Refus déterministe du triage symptomatique et du diagnostic individualisé via defense-in-depth 3 couches. Cohérence intended-purpose ↔ comportement vérifiée par CI.

## Conséquences
- (+) Budget/délai tenables. Risque pénal personnel (L.4161-1) maîtrisé.
- (−) Périmètre fonctionnel volontairement restreint (pas de CDSS, pas de triage).
- Bloquant : avis GIO ANSM à intégrer avant ouverture tier Pro.
- Ferme : toute feature diagnostique individuelle tant que non CE-marqué.

## Statut
Accepted. Source de vérité : docs/01_REGULATION.md.
