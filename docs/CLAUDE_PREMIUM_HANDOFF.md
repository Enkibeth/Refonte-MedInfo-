# Reprise Claude — dernière revue de la refonte premium

## Mission et branches

Hugo a choisi la direction A « Bureau de référence », puis demandé une intégration pour
que Claude fasse une dernière optimisation avant sa PR et sa fusion vers `main`.

- Dépôt : `Enkibeth/Refonte-MedInfo-`.
- Branche de reprise : `integration/refonte-premium`.
- Lot initial : `design/refonte-premium`, intégré par PR ; consulter son historique.
- Ne pas repartir de l’ancien ZIP de fondations. Les documents joints de juin sont
  antérieurs au dépôt actuel et à la décision de septembre.
- Ne pas recommencer une direction visuelle. Affiner et corriger A, sans transformation
  arbitraire en grille de cartes ou ajout d’effets décoratifs.

## À lire avant toute modification

`CLAUDE.md`, `START.md`, `.ai-governance.md`, `docs/01_REGULATION.md`, `docs/README.md`,
`docs/05_DESIGN.md` v2, ADR-0038 et les audits de juin/juillet demandés par Hugo.
Puis `docs/audits/2026-09-premium/DELIVERY.md`, les contrats UX, les captures et les
rapports JSON. La galerie avant/après se trouve dans ce même dossier.

## Ce qui est installé

- Tokens sémantiques v2 : blanc/encre/bleu vif ; trois polices conservées ; contours
  nets, focus visible, cibles 44 px, réduction des mouvements décoratifs.
- Accueil éditorial asymétrique, navigation et footer clairs, titres et champs partagés,
  harmonisation des écrans et des quatre éditeurs HTML autonomes.
- Chat : question et attente immédiates avant la préparation de l’historique ; verrou
  de soumission ; Arrêter accessible ; phases dérivées des parts reçues ; blocs Markdown
  clos conservés ; actions sous la réponse ; reprise client gardée par tour/conversation.
- Blog : distinction chargement/vide/erreur et action Réessayer.
- Générateur `scripts/design/sync-web-theme.cjs` : CSS et sprite d’icônes partagés avec
  les pages autonomes ; tests de synchronisation, sans changement des scripts de build.
- Aucun ajout de dépendance de production ni migration.

## Ce qui n’est pas certifié

Les captures des routes protégées représentent l’état réellement accessible sans session,
pas une certification du dashboard, de l’admin ou des outils sous chaque rôle.
Les mesures de streaming sont issues d’un flux local neutre, pas d’une requête médicale
réelle ni d’un benchmark des modèles. Les tests purs de reprise ne prouvent pas à eux
seuls « aucune réponse perdue après une veille ».

Lighthouse, p75 LCP/INP/CLS en production et appareils iOS/Android réels restent à vérifier.
Ne pas présenter un score de laboratoire comme un p75 de terrain. Les détails des
mesures disponibles et des réserves sont dans `DELIVERY.md`.

## Revue finale, dans cet ordre

1. Inspecter le diff complet par rapport à `main`, préserver tout changement concurrent.
   Vérifier en particulier le rendu incrémental : citations, numérotation des liens entre
   blocs, tableaux, listes, diagrammes, sections structurées, questions finales et
   régénération. Aucun bloc déjà lu ne doit être remplacé par un rendu différent en fin
   de réponse. Ajouter des tests si un cas pur manque.
2. Tester le chat réel avec des comptes de test autorisés, jamais en neutralisant RoleGate,
   la vérification des rôles ou la RLS : premier envoi, double clic, arrêt avant le premier
   fragment, arrêt pendant le flux, erreur réseau, nouvelle conversation pendant une
   attente, régénération, remontée du fil et retour en bas, veille/retour d’onglet.
   Vérifier l’ordre d’archivage et l’absence de doublons/troncatures. Ne pas promettre
   une archive aux invités : le contrat actuel n’en fournit pas.
3. Parcourir les trois rôles et l’admin sur les vrais écrans autorisés : objectif, primaire,
   parcours court, vide/chargement/erreur/succès/hors ligne. Vérifier clavier, focus de
   modale et restitution au déclencheur, fermeture Échap, survol, tactile, clavier mobile.
   Compléter l’harmonisation locale là où la passe transversale ne suffit pas.
4. Contrôler les quatre éditeurs autonomes avec du contenu fictif non médical, notamment
   les actions d’ajout/suppression, le zoom CV, les thèmes d’aperçu et les exports existants.
   Les couleurs du contenu exporté peuvent refléter le thème choisi ; la chrome UI doit
   utiliser les tokens partagés. Ne pas altérer les données ou les fonctions d’export.
5. Refaire les captures 390/768/1024/1440, axe (aucune erreur critique), reduced-motion
   et les parcours clavier. Mesurer LCP/INP/CLS avec la méthode réellement disponible,
   préciser environnement et échantillon. Comparer aussi le bundle au baseline.
6. Avant tout push : `npm run typecheck`, `npm run test:unit`, `npm run build:web`.
   Ne supprimer/affaiblir aucun test. Générer les thèmes partagés si les tokens changent :
   `node scripts/design/sync-web-theme.cjs`. Vérifier `git diff --check`.
7. Mettre à jour le design system si nécessaire, le tableau de livraison et
   `docs/CHANGELOG_AI.md`. ADR pour toute nouvelle décision structurante.

## Limites absolues

UI/UX uniquement : ne modifier ni prompts, ni routes API, ni logique serveur, ni base,
ni RLS, ni autorisations. Ne modifier ni `server/`, ni `scripts/hostinger/`, ni
`docs/09_DEPLOYMENT.md`, ni les scripts de build de `package.json`.
Ne pas déployer ni manipuler Hostinger/Supabase pour cette revue.

Garder les mentions « système d’intelligence artificielle », avertissements médicaux,
urgences 15/112 et accès aux sources sans paywall. Ne modifier aucun sens réglementaire.
Ne pas inventer de références, niveaux de preuve, chiffres, témoignages ou cas patients.

Arbitrages réservés à Hugo : activation des parts de sources dans l’API (`sendSources`
désactivé par défaut dans le chemin actuel), garantie d’archive invitée, terminologie
clinique héritée (« aide à la décision ») et toute extension de périmètre nécessaire
pour corriger une cause serveur. Signaler ces besoins ; ne pas les trancher seul.

## Livraison et fusion finale

Travailler sur une branche de revue créée depuis `integration/refonte-premium` ; faire
des commits ciblés et intégrer les corrections dans cette branche d’intégration.
Hugo demande ensuite une PR finale de `integration/refonte-premium` vers `main` et sa
fusion après revue, tests et CI verts. Respecter toutes les protections GitHub : aucun
force-push, contournement, fusion avec vérification obligatoire rouge ou scope interdit.
Si une condition bloque, rendre la PR et le blocage précis au lieu de fusionner.

Compte rendu attendu : lien PR et SHA fusionné, captures clés lisibles, tests exécutés,
mesures réelles, problèmes restants et arbitrages Hugo. Ne pas appeler la refonte
« entièrement validée » tant que les parcours connectés et les critères critiques du
chat ne sont pas démontrés.
