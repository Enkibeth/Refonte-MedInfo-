# ADR-0020 — Multi-rôles vérifiés + bascule libre entre chats

```yaml
status: Accepted
date: 2026-06-07
owner: Hugo Bettembourg
amends: ADR-0011 (étend la vérification à un ENSEMBLE de rôles acquis ; les garde-fous
  anti-auto-promotion et la safe-box restent inchangés)
linked_to: [ADR-0006, ADR-0018, 01_REGULATION §5]
```

## Contexte
ADR-0011 attribue UN rôle actif vérifié à la fois (`profiles.persona`). En pratique un même
compte peut légitimement être à la fois **étudiant** (email académique) et **professionnel**
(RPPS). On veut qu'une fois un rôle validé, l'utilisateur puisse **basculer librement entre
les chats de ses rôles vérifiés** sans re-fournir de preuve à chaque changement, et voir un
**badge de validation** par rôle.

## Décision
1. **Ensemble de rôles vérifiés** : nouvelle colonne `profiles.verified_personas persona[]`
   (migration `0016`), défaut `{public}`. Le rôle ACTIF (`persona`) doit appartenir à cet
   ensemble. Backfill : un rôle non-public déjà `verified` y est ajouté.
2. **Bascule libre** : si le rôle demandé est DÉJÀ dans `verified_personas`, `/api/role`
   change le rôle actif **sans re-vérification** (aucune preuve email/RPPS demandée). Sinon, la
   vérification ADR-0011 s'applique et, en cas de succès, le rôle rejoint l'ensemble.
3. **Sécurité (inchangée, non négociable)** : `verified_personas` est protégée par le même
   trigger anti-élévation que `persona`/`status` (0005, étendu en 0016) — seul un rôle
   `BYPASSRLS`/service_role peut l'écrire. Le client ne s'auto-promeut jamais. La vérification
   pro reste `pending` sans `ANNUAIRE_SANTE_API_KEY` (aucune écriture).
4. **UI** :
   - Accueil : une fois connecté, le bouton « Se connecter » disparaît (→ « Mon compte ») et
     seuls les chats des rôles vérifiés sont affichés (par défaut : public uniquement).
   - Compte : badges de validation par rôle (Validé / Actif / En attente / Non validé) +
     boutons « Passer en … » pour basculer le chat actif, et déconnexion.

## Limites
- Le masquage UI n'est jamais l'unique barrière (ADR-0018) : l'autorisation réelle des routes
  IA reste dérivée du profil vérifié côté serveur.
- Aucune donnée de santé. Les features cliniques pro restent gelées par ADR-0006.

## Rollback
git revert ; la colonne `verified_personas` peut rester (défaut `{public}`, sans impact) ou
être supprimée par migration descendante.
