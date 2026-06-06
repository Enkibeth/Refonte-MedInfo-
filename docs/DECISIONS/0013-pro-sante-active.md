# ADR-0013 — Pro santé activé (vérif RPPS réelle + accès chat)

```yaml
status: Accepted
date: 2026-06-06
owner: Hugo Bettembourg
builds_on: ADR-0011 (sélection + vérif de rôle pro)
linked_to: [ADR-0006, ADR-0007, 01_REGULATION §5, 06_BILLING §10]
```

## Contexte
ADR-0011 a sorti du gel la **sélection** et la **vérification** du rôle pro, mais laissait
deux points ouverts : (a) la vérif RPPS/ANS réelle (renvoyait `pending` sans clé), (b) le pro
n'avait pas de quota de chat exploitable (limite à `0`). La clé `ANNUAIRE_SANTE_API_KEY` est
désormais disponible : on finalise l'activation du compte **professionnel de santé**.

## Décision
1. **Vérification RPPS réelle** (`src/auth/annuaireSante.ts`) câblée dans `/api/role` : si
   `ANNUAIRE_SANTE_API_KEY` est présente, le RPPS doit exister dans l'Annuaire Santé (FHIR) →
   sinon `422`. ANS injoignable → `502` (strict sur le pro, 06_BILLING §10.4). Sans clé :
   repli sur la seule validation de format (comportement historique).
2. **Accès chat pro activé** : quota gratuit aligné sur l'étudiant (20 msg/j).
3. **Switcher de mode** dans le chat : les comptes **étudiant** et **pro santé** basculent
   entre les 3 modes (public / étudiant / pro) ; le **grand public** reste verrouillé sur
   « public ». Le mode actif est transmis par requête à `/api/chat`.

## Ce qui reste gelé par ADR-0006 (inchangé)
Le **module rapport clinique** et la **commercialisation pro** (aucun plan payant pro) restent
conditionnés aux prérequis d'ADR-0006 (avis GIO ANSM, RCP pro, golden set adversarial…).
**La safe-box complète s'applique au pro** (classifieur + prompt + validation de sortie) :
aucun triage/diagnostic/pronostic individualisé. Aucune donnée de santé.

## Conséquences
- (+) Onboarding pro fonctionnel de bout en bout ; surface unique réutilisable.
- (−) Surface plus exposée → à confirmer : avis GIO ANSM (déjà tracé ADR-0011).
- **Limite connue (sécurité)** : `/api/chat` fait confiance au `persona` du body sans le
  revérifier contre le profil ; le switcher est donc gated **côté UI seulement**. Une
  vérification serveur (plafonner le mode au rôle réel) est à traiter dans un ADR/chantier
  dédié si l'on veut durcir au-delà du gate UI.

## Rollback
git revert ; remettre `DAILY_LIMITS.professional = 0`, retirer le switcher et neutraliser le
lookup RPPS (`/api/role` renvoie `pending` pour le pro comme avant).

## Statut
Accepted
