# ADR-0039 — Photographies d’illustration sur l’accueil

- Date : 2026-09-28
- Statut : Accepted — demande de Hugo d’ajouter des photos et de rendre l’accueil plus humain
- Portée : présentation de l’accueil uniquement

## Contexte

La direction A « Bureau de référence » est en place. L’accueil présente ses
trois espaces et ses outils essentiellement par du texte. Hugo demande une
présence photographique plus humaine, cohérente avec les usages.

## Décision

Ajouter trois photographies réelles : apprentissage à plusieurs dans le hero,
travail documentaire près des outils et lecture avec prise de notes près des
sources. Les trois accès par audience sont regroupés immédiatement après le
hero. Typographies, couleurs, liens et filtrage des outils par rôle sont conservés.

Les photos sont des illustrations, pas des utilisateurs ou des témoignages.
Provenance et licence sont consignées dans `assets/landing/README.md`. Les assets
sont servis localement, avec WebP adaptatif sur le web et JPEG sur natif.

## Conséquences

- Une page plus incarnée, sans dépendance de production supplémentaire.
- Un ajout maximal de 130 Kio de photos web, dont deux chargées progressivement.
- Les dimensions sont réservées dès le pré-rendu et les variantes desktop sont
  aussi exprimées en CSS pour éviter une bascule de composition à l’hydratation.
- Aucun changement de fonction médicale, de prompt, d’autorisation ou de données.
- Retour arrière : revert du commit ; aucune migration.
