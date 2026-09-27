# MedInfo AI — audit initial et choix de direction

Date : 26 septembre 2026. Auteur : Codex. Statut : **audit initial, validation visuelle attendue**.

Base : `main`, commit `2d51d336058d33f36e3247b3fc97eb96c123b4e0`.
Branche de travail : `design/refonte-premium`.

## Ce qui est livré et ce qui ne l’est pas

Cette livraison couvre l’investigation de l’étape 0 et deux propositions de l’étape 1.
**Aucun écran de l’application n’a été modifié.** Les HTML du dossier `directions/`
sont des études visuelles statiques, pas une deuxième application ni des fonctionnalités
livrées. Les boutons autres que les liens de navigation sont illustratifs.

L’objectif est un produit premium, distinctif et attractif, pas uniquement une réduction
du bruit visuel. Le logo existant est conservé. La composition, les contrastes de taille
typographique et la présentation des références donnent la personnalité ; aucun dégradé,
halo, illustration générique, témoignage ou contenu médical fabriqué n’est ajouté.

Les captures correspondent à des fenêtres de contenu de **390 × 844, 768 × 900,
1024 × 900 et 1440 × 900 pixels CSS** dans Chromium, pilotées par Playwright.
Il s’agit de cadres responsives du véritable export web, pas d’une émulation iPhone.
Les captures montrent le premier écran, pas nécessairement la totalité d’une page longue.
Le banc d’audit est distinct du dépôt produit ; il sert les fichiers exportés sans
modifier leur code et renvoie une erreur explicite pour les API locales non servies.

Les rôles n’ont pas été contournés. Une capture d’une barrière d’accès ou d’une
redirection vers la connexion **ne vaut pas vérification de l’outil connecté**.
Les états non observés sont identifiés dans la matrice, jamais présentés comme validés.

### Preuves

- [Galerie des directions et captures](index.html).
- [Inventaire écran × état × largeur](inventory.csv).
- [Objectif, action, parcours, états et microcopie par écran](screen-contracts.md).
- [Synthèse des mesures disponibles](metrics-summary.md).
- `metrics/` : rapports axe bruts, texte réellement affiché, dimensions et petites cibles.
- `captures/` : état initial (`baseline-…`) et **propositions** (`proposal-…`).
- `checks/` : traces des contrôles TypeScript, tests unitaires et build.

## Synthèse critique

La base possède déjà des éléments utiles : polices différenciées, icônes centralisées,
tests de phases et de reprise, défilement conditionnel, confirmations de suppression,
garde d’accès par rôle et composants de chargement. Les conserver coûte moins cher et
réduit les risques par rapport à une réécriture.

La priorité est de corriger l’attente et la confiance affichée. Le premier envoi connecté
attend la création d’une conversation avant de mettre le message dans le flux UI. Les
sources structurées du SDK ne sont pas activées dans la réponse serveur. Certains
libellés de l’accueil décrivent une vérification de liens qui ne correspond plus au
chemin actuel. Le rendu Markdown est reparsé à chaque changement du texte, avec un
risque de recomposition des tableaux et sections en cours de réception.

La promesse « zéro décalage » n’est **pas démontrée**. Ni le p75 des Core Web Vitals,
ni la conservation d’une réponse après veille iOS ne peuvent être déduits des tests
unitaires et des captures. Ces critères demandent une campagne connectée instrumentée.

## Problèmes classés

P1 = priorité avant la refonte écran par écran. P2 = harmonisation / usage. Aucun incident
P0 de production n’a été établi par cette inspection. « Code » indique une observation
du chemin statique ; ce n’est pas une reproduction réseau complète.

| ID | Gravité | Constat et preuve | Décision proposée, non appliquée |
|---|---|---|---|
| UX-01 | P1 | `chat.tsx`, `sendText` : `await createConversation` précède `sendMessage`. `handleSend` vide déjà la saisie. L’état `submitted` et Arrêter arrivent donc après cette attente. | Accusé local synchrone et verrou de soumission avant tout `await` ; annulation possible pendant cette préparation. Conserver les mêmes contrats serveur. |
| UX-02 | P1 | `app/api/chat+api.ts` appelle `toUIMessageStreamResponse()` sans option ; dans la version installée du SDK, `sendSources` vaut `false`. Le client extrait les sources du texte. | Ne montrer aucune source « trouvée » sans événement réel. Activer `sendSources: true` demanderait une exception au périmètre API : arbitrage Hugo. |
| UX-03 | P1 | `chat.tsx` associe tout outil à « recherche », sans tenir compte de son état ; `streaming` sans outil devient « rédaction » même avant le texte. `monotonicProgress` n’est pas consommé dans le rendu. | Étendre `statusPhases.ts` et les anneaux existants ; phases selon événements, pas selon minuterie. Pas de pourcentage de travail accompli. |
| UX-04 | P1 | `AssistantBlocks` parse tout `text` à chaque changement ; `MarkdownRenderer` reparcourt ses blocs. Une ligne de tableau partielle peut changer de nature en arrivant à sa barre finale. | Blocs clos immuables et mémorisés ; tampon du bloc actif ; tableaux/fences réservés à un conteneur stable. Mesurer déplacement des blocs déjà lus, pas seulement le score CLS. |
| UX-05 | P1 | `ChatStatusRing.web.tsx` place le temps écoulé et les phases sous la même zone `aria-live`. Le temps est actualisé chaque seconde. | Zone live dédiée au libellé de phase ; durée non annoncée. Vérifier avec lecteur d’écran, pas seulement axe. |
| UX-06 | P1 | `resume.ts` protège le remplacement par comparaison de préfixe. Dans `chat.tsx`, reprise par archive, régénération et changement de conversation ont des chemins distincts ; le retour de visibilité peut précéder l’archivage. | Étendre les tests de courses, conserver le préfixe, lier toute reprise au tour/conversation courants. Ne pas modifier l’archivage serveur. |
| UX-07 | P1 | L’essai invité n’a pas de conversation archivée. Le texte d’attente prolongée promet pourtant de retrouver la réponse après avoir quitté l’app. | Microcopie distincte invité/connecté. La garantie universelle « aucune réponse perdue » nécessite un arbitrage de périmètre, pas une promesse UI. |
| UX-08 | P1 | Accueil : « chaque lien est vérifié », « zéro lien mort », connecteurs dédiés annoncés. ADR-0037 a supprimé le mécanisme d’outils/vérification correspondant. Constat code et DOM. | Proposer une copie factuelle correspondant aux capacités servies, puis validation Hugo. Aucune affirmation de fiabilité absolue. |
| UX-09 | P1 | Accueil et chat professionnel utilisent « support/aide à la décision ». Le but réglementaire canonique exclut l’influence sur la décision individuelle. | Revue de cohérence réglementaire par Hugo ; ne pas réécrire les textes réglementaires unilatéralement. |
| UX-10 | P1 | Axe : avertissement de connexion `#9A6516` sur `#FBF1DD`, ratio signalé 4,4:1 pour un texte de 12,5 px. | Corriger le token sémantique d’avertissement après choix ; tester tous ses consommateurs. |
| UX-11 | P2 | Cibles de 38/40 px dans le chat, 28/30/32 px dans l’historique/modales. Mesures et styles. | Conteneur interactif ≥ 44 px sur tactile, sans grossir tous les glyphes. Un résultat < 44 px n’est pas automatiquement une violation WCAG 2.5.8. |
| UX-12 | P2 | Multiples accents par persona et outil ; cartes arrondies/ombres récurrentes ; décor animé du hero. | Un seul bleu d’action, variations de neutres, états sémantiques avec texte/icône ; moins de cartes. |
| UX-13 | P2 | `Reveal` ajoute 140 ms à la durée lente de 320 ms ; utilisé pour chaque message. | Réserver le mouvement aux changements fonctionnels, entre 120 et 320 ms. Aucun fade de chaque réponse. |
| UX-14 | P2 | Le shell desktop et la colonne historique peuvent se cumuler dès 1024 px. | Navigation compacte ; historique en tiroir lorsque la zone de lecture devient trop étroite. Seuil à tester, pas simplement déduit du nom « desktop ». |
| UX-15 | P2 | `ButtonRow` n’impose pas l’alignement Annuler / primaire à droite ni une règle tactile commune. | Primitive d’actions responsive ; une primaire par bloc, destruction séparée et confirmée. |
| UX-16 | P2 | L’accueil expose plusieurs titres de sections de niveau 1, tandis que son titre visuel principal n’est pas exposé comme titre dans le DOM inspecté. | Un h1 de page et une hiérarchie h2/h3 réelle. Vérification clavier et lecteur d’écran. |
| UX-17 | P2 | Blog : une erreur de chargement devient la même liste vide que l’absence d’articles (`catch(() => setPosts([]))`). | Distinguer absence de contenu et échec réseau ; Réessayer sans perdre la navigation. |
| UX-18 | P2 | Pages autonomes : CSS et polices distincts du système Expo (Public Sans/JetBrains/Source Serif selon les vues). | Contrat de variables généré ou test d’égalité avec les tokens ; garder les moteurs des outils inchangés. |
| UX-19 | P2 | Sources/questions/approfondissements peuvent apparaître lors du parsing partiel ; les actions ne doivent pas concurrencer un envoi. | Appendre les sections finalisées après le texte déjà lu, ne pas les insérer au-dessus ; actions visibles en fin de réponse, au focus et sur tactile. |
| UX-20 | P2 | Le retour manuel en bas appelle par défaut un scroll animé, indépendamment de `prefers-reduced-motion`. | Même contrat de mouvement que le reste du chat ; suivre uniquement tant que l’utilisateur est au bas du fil. |
| UX-21 | P1 | Axe identifie des erreurs critiques `label` et `select-name` dans les pages autonomes Présentation et Article, aux quatre largeurs. Présentation présente aussi des défauts de contraste, taille de cible et défilement clavier ; Article bloque le zoom par sa meta viewport. | Associer chaque champ à son libellé, autoriser le zoom, rendre les régions défilables utilisables au clavier. Corriger après choix sans modifier le moteur des outils. |
| UX-22 | P1 | À 390 px, débordement sur accueil, tarifs, blog, article absent, à propos et contact. Sur l’accueil, le bouton du header « Commencer » atteint x = 405,23 px ; le décor dépasse aussi légèrement. Mesure des rectangles DOM. | Réduire le header mobile à une navigation adaptée et une action principale ; contenir le décor ou le retirer. Ne pas masquer globalement le débordement au risque de couper le focus. |

### Porte de push

Les erreurs critiques axe préexistent à ce lot. Elles n’ont pas été masquées ni réparées
pendant l’étape « sans code ». La condition demandée avant **tout push** n’est donc pas
satisfaite : cette livraison reste sur la branche locale, sans push ni PR en brouillon.
Après validation de la direction et correction de ces erreurs, les lots pourront être
poussés et la PR en brouillon ouverte. Une exception limitée à une PR purement documentaire
peut être autorisée par Hugo, mais n’est pas présumée.

Le contrôle des mentions IA et des urgences doit couvrir les deep-links et l’essai invité,
pas uniquement le footer de l’accueil. Dans les propositions, les textes canoniques sont
présents sans changement de sens. L’accès aux références reste indépendant de l’abonnement.

## Deux directions, pas deux palettes

### A — Bureau de référence (recommandée pour l’usage fréquent)

Une navigation latérale calme, une grille compacte et des actions au même endroit.
Le titre éditorial et l’italique bleu donnent une signature à l’accueil ; un filet bleu
sert de repère dans les écrans de travail. Les trois espaces sont une liste hiérarchisée,
pas trois cartes identiques. Les surfaces de saisie sont plus nettes que les zones de
lecture. Les contrastes de densité produisent l’attractivité sans décor flottant.

Avantage : repères constants entre chat, dashboard et outils ; adaptée à des sessions
répétées. Coût : navigation persistante à contrôler sur les largeurs intermédiaires.
La liste des entrées sera toujours dérivée de `featureVisibility`, jamais de ces maquettes.

### B — Cahier médical (signature éditoriale plus marquée)

Navigation horizontale, papier clair neutre, grands titres en Source Serif 4, filets fins
et rythme de publication. L’index « 3 espaces » désigne les trois chatbots réellement
présents, pas une statistique de performance. Le chat privilégie la lecture et le document
devient un formulaire éditorial, sans empilement de cartes. Bleu identique à A.

Avantage : identité plus singulière pour l’accueil, le blog et les longues réponses.
Coût : davantage de défilement et moins de navigation persistante ; densité à réduire
pour les écrans admin et outils complexes, sans créer un second design system.

### Commun aux deux

- Source Serif 4 pour les pages, Schibsted Grotesk pour l’interface, Inter pour le corps.
- Logo actuel et icônes linéaires issues du vocabulaire existant ; pas d’étincelles.
- Une primaire ; Annuler à sa gauche sur desktop et après elle dans l’ordre visuel mobile.
- Outils à gauche du composer, Arrêter/Envoyer à droite ; cible de 44 px.
- Attente sans progression inventée, sources disponibles seulement lorsqu’elles existent.
- État désactivé expliqué sur l’analyse de document ; aucun faux fichier, résultat ou patient.
- Styles de focus et réduction de mouvement prévus. Ces études statiques ne prouvent pas
  le fonctionnement du clavier virtuel, des dialogues ou du streaming de l’application.

## Contrat de vérification du prochain lot chat

1. Horodater `submit` et premier rendu local : indicateur et Arrêter < 100 ms, même si la
   création de conversation dure 2 s. Aucun second envoi concurrent possible.
2. Rejouer des fixtures de parts UIMessage (raisonnement, outil commencé/terminé/échoué,
   texte, sources si autorisées), plus un vrai flux par mode et persona autorisée.
3. Capturer les rectangles des blocs déjà finalisés à chaque fragment ; ils ne doivent
   ni changer d’ordre ni se déplacer hors effet de défilement explicitement demandé.
   Mesurer CLS avec ses fenêtres de session ; les deux mesures sont complémentaires.
4. Flux long avec tableaux, listes et fence coupés à chaque caractère : coût de parsing
   limité au bloc actif, pas au texte complet ; pas de remplacement paragraphes/tableaux
   déjà affichés. Réduire la fréquence du rendu seulement si la fluidité reste satisfaisante.
5. Remonter le fil pendant la génération : pas d’autoscroll forcé. « Revenir en bas »
   visible, focusable, respectant la réduction de mouvement.
6. Arrêter pendant la préparation, pendant le flux, puis Réessayer. Préserver le texte
   effectivement reçu et ne pas réenvoyer automatiquement une question.
7. Changer d’onglet/app et revenir avant/après `onFinish`, avec archive retardée, réseau
   coupé et régénération. Tester aussi le changement de conversation pendant la reprise.
8. Références visibles même après limite de quota ; aucune nouvelle barrière payante.
9. Clavier seul, VoiceOver/NVDA, zoom texte, tactile et Safari iOS/Chrome Android ; arrêt
   et composer non masqués par clavier. Axe n’est qu’un volet de cette vérification.
10. `npm run typecheck`, `npm run test:unit`, `npm run build:web` avant chaque push ; tests
    existants conservés, tests purs ajoutés pour nouvelle logique. Comparaisons aux quatre largeurs.

## Arbitrages réservés à Hugo

| Arbitrage | Recommandation | Ce qui reste inchangé en attendant |
|---|---|---|
| A ou B | A pour le travail quotidien ; B si l’identité éditoriale prime | Tokens v1.4 et tous les écrans produit |
| Sources pendant l’attente | Autoriser séparément l’option de sérialisation `sendSources`, si le provider émet bien les sources à temps | Aucune route API modifiée ; pas de faux flux de sources |
| Copie « liens vérifiés », « aide à la décision » | Aligner les promesses avec les capacités réelles et la finalité prévue | Textes produit et réglementaires inchangés |
| Reprise des invités | Clarifier explicitement sa limite ; une vraie garantie de persistance dépasse une simple refonte UI | Pas de stockage ni de migration ajoutés |
| QA connectée | Session de test autorisée pour public/étudiant/pro/admin, sans données patient | Aucun compte créé, rôle modifié ou accès forgé |

**Arrêt volontaire avant l’étape 2.** `docs/05_DESIGN.md` reste en v1.4 ; sa v2,
les corrections et les comparaisons avant/après réelles seront faites après le choix.

## Sources primaires

- [Code audité à la base immuable](https://github.com/Enkibeth/Refonte-MedInfo-/tree/2d51d336058d33f36e3247b3fc97eb96c123b4e0).
- Gouvernance : `CLAUDE.md`, `START.md`, `.ai-governance.md`, `docs/01_REGULATION.md`,
  `docs/README.md`, `docs/05_DESIGN.md`, audits design/chatbot/UX 2026-06/07, ADR-0037.
- [AI SDK — Chatbot, UIMessage et sources](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot) ;
  comportement exact confirmé dans la version verrouillée de `ai`, `stream-text.ts`.
- [W3C — cibles minimales WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
- [W3C — contraste du texte](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
- [web.dev — différences entre laboratoire et terrain](https://web.dev/articles/lab-and-field-data-differences).
- [web.dev — décalages de mise en page](https://web.dev/articles/optimize-cls).

Les documents de fondation joints ont été consultés comme historique. En cas d’écart,
l’état actuel du dépôt et les décisions explicites de ce chantier sont distingués ;
les anciennes couches réglementaires ne sont pas supposées actives parce qu’un document
ancien les mentionne. Cet audit UI n’est pas une certification réglementaire.
