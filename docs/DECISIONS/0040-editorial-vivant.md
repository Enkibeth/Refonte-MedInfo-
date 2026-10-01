# ADR-0040 — Une identité éditoriale plus vivante

- Date : 2026-09-30
- Statut : Accepted — demande explicite de Hugo, décisions visuelles déléguées
- Portée : présentation, couleurs partagées, accueil ; pas de modification métier

## Contexte

Après ajout de trois photographies (ADR-0039), Hugo trouve le site trop blanc et
uniformisé. Il demande plus de vie et confie la vérification fonctionnelle à
Claude Code. La direction A et les photographies sont conservées.

## Décision

Créer un rythme de lecture : bleu brume pour l’accueil, ivoire autour des trois
espaces, blanc pour les outils, bleu nuit pour les sources. Sauge, lilas et bleu
distinguent les audiences ; les outils retrouvent des pastilles colorées via
leur mapping existant. Les textes, actions, accès par rôle et mentions restent
inchangés. Les photographies sont montées sur des aplats lilas et sable.

Les tokens globaux distinguent maintenant fond de page et surface de lecture.
Les quatre pages autonomes consomment leur feuille régénérée. Les nouveaux
couples texte/fond sont couverts par des tests de contraste (>= 4,5:1).

## Limites et transmission

- Aucun nouveau témoignage, badge de validation, score ou promesse médicale.
- Aucun changement de prompt, API, données, abonnement ou hébergement.
- Les erreurs de synchronisation du pré-rendu et le test de navigation non
  concluant de l’itération photos sont conservés comme points de reprise, pas
  annoncés résolus par cette évolution visuelle.
- Pas de déploiement ni de merge sans la recette de Claude Code.
- Retour arrière : revert de la modification UI ; aucune migration.
