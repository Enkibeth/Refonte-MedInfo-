# ADR-0011 — Rôles actifs (public / étudiant / pro) + vérification

```yaml
status: Accepted
date: 2026-06-04
owner: Hugo Bettembourg
amends: ADR-0006 (sort la SÉLECTION de rôle pro + la vérif du report ; les garde-fous
  cliniques/commerciaux d'ADR-0006 restent en vigueur)
linked_to: [ADR-0007, 01_REGULATION §5, 06_BILLING §10]
```

## Contexte
On veut un onboarding où l'utilisateur choisit son rôle : **grand public**, **étudiant**
(vérifié) ou **professionnel** (vérifié). L'ADR-0006 reportait toute surface pro.

## Décision
1. **Activer la sélection de rôle** pour les trois personas, avec vérification :
   - **Public** : aucun login requis (01_REGULATION §5), aucune vérification.
   - **Étudiant** : vérification par **email de domaine académique** (heuristique
     `isAcademicEmail`) — PII minimale, aucun document stocké, aucune donnée de santé.
   - **Professionnel** : vérification par **numéro RPPS** via **ANS Annuaire Santé (FHIR)**.
     Vérifier l'identité d'un professionnel **n'est pas du MDSW**.
2. **Sécurité (non négociable)** : `persona`/`status` ne sont JAMAIS auto-attribuables par le
   client. Un trigger Postgres bloque tout changement de `persona`/`status` par un rôle non
   `BYPASSRLS`. Les rôles vérifiés sont écrits **uniquement côté serveur** (`/api/role`,
   service_role) après vérification. → pas d'auto-promotion étudiant/pro.
3. Le persona `professional` est **routable et activé** (`enabledInMvp=true`).

## Ce qui reste conditionné par ADR-0006 (inchangé)
Le rôle pro existe et peut être vérifié, mais **les features cliniques pro et la
commercialisation pro** restent conditionnées aux prérequis d'ADR-0006 : avis GIO ANSM écrit,
note de qualification interne, RCP pro, télémétrie de conformité + golden set adversarial.
**Le pro reste soumis à la safe-box complète** (classifieur + prompt + validation de sortie) :
aucun triage/diagnostic/pronostic individualisé, comme pour le public (01_REGULATION).

## Limites (étapes suivantes)
- L'intégration **RPPS/ANS** réelle est à finaliser : tant que `ANNUAIRE_SANTE_API_KEY` n'est
  pas configurée, `/api/role` renvoie `pending` pour le pro (aucune attribution du rôle).
- OAuth/flux natifs : cf ADR-0010.
- Prompt `professional.v2` non activé (cf 04_CHATBOT §7) : le pro utilise le chat encyclopédique
  général tant que le prompt pro n'est pas livré sous les conditions ADR-0006.

## Impact réglementaire
Potential (maîtrisé) : ouverture du rôle pro = surface plus exposée, MAIS (a) safe-box
inchangée et appliquée au pro, (b) features cliniques pro toujours gelées par ADR-0006,
(c) vérification d'identité ≠ MDSW. Aucune donnée de santé. À confirmer : avis GIO ANSM.

## Rollback
git revert ; remettre `professional.enabledInMvp=false` et retirer la surface de sélection pro.
