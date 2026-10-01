# ADR-0041 — Présenter le produit avant le cadre juridique

- Date : 2026-10-01
- Statut : Accepted — retour et demande explicites de Hugo
- Portée : éditorial, photographie principale, cohérence des fondations visuelles

## Demande

Hugo valide les photos travail et sources, souhaite des étudiants en médecine
pour la première et une présentation plus positive de son travail, des modèles
IA et des fonctionnalités. Il demande également si le thème est partagé partout.

## Décisions

- Première photo remplacée par la scène Pexels 3985154 de Gustavo Fring.
  Affichage 3:2 pour conserver les trois personnes, variantes locales web/natives.
  Photos 2 et 3 inchangées ; l’ancienne première sélection reste disponible.
- Accroche et section bleu nuit orientées usages : assistants, ECOS, révisions,
  outils de création et références. À propos valorise le créateur et la formation
  médicale sans inventer de témoignage, diplôme, certification ou résultat.
- Retrait de la longue copie de `INTENDED_PURPOSE` dans le bloc commercial
  d’accueil. Le texte canonique et ses emplacements légaux ne sont pas modifiés.
  Disclosure IA, footer médical permanent et FAQ 15/112 conservés.
- GPT-6 Luna présenté comme **défaut de cette version**, confirmé dans
  `featureModel.ts`, et non comme garantie de configuration administrateur en
  production. Pas de promesse « tous les derniers modèles » ni d’inférence selon
  laquelle un modèle plus récent garantirait une fiabilité médicale.
- 26 pages reliées aux tokens ou à `LegalScreen`, plus quatre outils HTML reliés
  aux tokens CSS. Quelques couleurs locales de chrome autonome remplacées par
  des variables. Drapeaux, couleurs de marques et documents produits préservés.
- Même feuille de polices locale pour Expo web et les outils HTML. Ajout des
  graisses Inter/Schibsted 400–700, sous-ensemble latin et licences OFL. Aucun
  ajout de dépendance applicative ni d’appel externe au chargement des polices.

## Vérification et limites

Tests ciblés de copie, couverture du thème, polices locales, mentions légales et
droits d’accès UI. Cette couverture de code ne prouve pas une recette visuelle
exhaustive. Claude Code conserve la vérification des parcours réels, de la
configuration active et des problèmes d’hydratation/routage antérieurs.

La tentative de nouvelles captures s’arrête sur un SIGSEGV de Chromium local.
Les captures précédentes ne sont donc pas présentées comme l’état visuel de cette
révision. Aucun merge, déploiement, migration ou changement métier.

Retour arrière : revert du changement UI/éditorial ; aucune donnée à restaurer.
