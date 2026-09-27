# MedInfo AI — Design System v2

Version 2.0 — 26 septembre 2026. Direction A « Bureau de référence », choisie par Hugo.
Source exécutable : `src/ui/tokens.ts`. Décision : ADR-0038. Web prioritaire ; variantes natives conservées.

## 1. Principes

Une interface de lecture et de travail. Blanc, encre nette, bleu vif parcimonieux, composition éditoriale asymétrique. La personnalité vient des proportions, des alignements et de la typographie. Ni dégradé décoratif, ni halo, ni verre, ni emoji/icône étincelle, ni grille uniforme de cartes. Les références, dates et niveaux de preuve sont ceux effectivement disponibles ; aucune garantie de vérification universelle.

## 2. Tokens sémantiques

| Usage | Token | Valeur web |
|---|---|---|
| Page / surface | background / surface | #FFFFFF |
| Navigation, surfaces secondaires | surfaceAlt | #F6F7F9 |
| Encre | text | #142034 |
| Texte secondaire | textMuted | #526174 |
| Accent texte, focus | accent | #0052D6 |
| Action primaire | accentVivid | #0067FF |
| Séparateur | border | #D8DFE7 |
| Limite interactive | borderStrong | #7D8998 |
| Avertissement | warningText / warningBackground | #80500C / #FBF1DD |

Les aliases d’audience et d’outils convergent vers le même bleu. Vert, rouge et ambre désignent exclusivement succès, erreur et avertissement ; toujours accompagnés de texte/icône. Aucun mode sombre livré. Les noms sémantiques permettent une future autre palette.

Espacement : 4, 8, 12, 16, 24, 32, 48, 64. Rayons : 4/6/8/12 ; pilule réservée aux petits états. Contrôles : minimum 44 px de hauteur et de largeur pour une icône. Bordure 1 px ; filet éditorial 3 px. Les cartes de contenu n’ont pas d’ombre ; seules les surfaces superposées peuvent avoir une ombre discrète.

## 3. Typographie

Source Serif 4 : titres de page, accroche et sections éditoriales. Schibsted Grotesk : titres d’interface, navigation et actions. Inter : corps, aides et champs. JetBrains Mono : identifiants et valeurs techniques déjà présentes.

| Niveau | Taille / interligne |
|---|---|
| Accueil large | 60 / 68 |
| Display compact | 40 / 46 |
| Page | 32 / 40 |
| Section UI | 22 / 30 |
| Sous-section | 18 / 26 |
| Introduction | 17 / 27 |
| Corps | 15 / 24 |
| Contrôle | 14 / 20 |
| Note | 13 / 20 |

Un h1 par page, puis h2/h3 selon la structure. Pas de capitales systématiques. Aucun blocage de zoom ou de mise à l’échelle native. Les libellés peuvent passer à la ligne.

## 4. Composition

Largeur page 1200, lecture 760, formulaire 560. Marges 16 sur petit écran, 24 et plus au-delà. Breakpoints : 640 (formulaires/actions), 768 (tablette), 1024 (shell), 1280 (historique du chat en colonne). La navigation latérale mesure 224, l’historique 256 ; entre 1024 et 1279, l’historique reste un panneau.

Pré-rendu web : les pages sont pré-rendues sans fenêtre (largeur 0, mise en page compacte), sans stockage local, sans paramètres d’URL ni détection navigateur. Le premier rendu client doit produire le même HTML, sinon React jette le pré-rendu (erreur #418). Largeur : `useWindowWidth()` (`src/ui/useWindowWidth.ts`), jamais `useWindowDimensions`. Préférence locale, paramètre d’URL ou capacité navigateur qui change l’affichage : `useClientState()` (`src/ui/hydration.ts`), appliqué après l’hydratation et jamais réécrit avant d’avoir été lu. Un élément réservé au mobile peut être masqué dès le pré-rendu par une règle CSS de `app/+html.tsx` (barre d’onglets ≥ 1024).

Le titre et le contexte sont en haut à gauche, les actions de page en haut à droite. Fil d’Ariane dans le shell desktop. Les listes privilégient séparateurs et alignement des métadonnées. Une carte regroupe un objet ou un formulaire ; elle n’est pas l’unité par défaut de toute mise en page.

## 5. Composants et actions

| Composant | Contrat |
|---|---|
| Button | Une primaire par bloc ; secondaire bordée, tertiaire discrète. Chargement conserve le libellé et la taille. Destruction en contour rouge, séparée et confirmée/annulable. |
| ButtonRow | Desktop : Annuler à gauche, primaire à droite. Mobile : pleine largeur, ordre DOM cohérent avec le focus. |
| Champ | Libellé permanent accessible ; aide sous le champ, erreur explicite ; bordure contrastée et focus net. Clavier adapté. |
| Onglets | Sélection par texte/position + couleur, cible 44 ; options longues repliées, jamais comprimées illisiblement. |
| Card / liste | Fond blanc, bordure fine, rayon mesuré ; aucune élévation par défaut. |
| Modale / feuille | Titre, fermeture nommée, action à droite ; Annuler à gauche. Focus géré par la primitive native/web, fermeture clavier. |
| Bannière / toast | Message autonome et actionnable ; aria-live poli, pas de disparition nécessaire pour comprendre une erreur. |
| État vide | Expliquer ce qui manque, une action de départ ; ne jamais transformer une panne en absence de données. |
| Skeleton | Statique, mêmes dimensions/structure que le contenu attendu. Pas d’animation décorative. |
| Badge | Texte court, état non porté par la couleur seule ; pas de label médical inventé. |

Les boutons d’icône ont un nom accessible et une infobulle web. Les cibles sont de 44 × 44 au minimum. Aucun contrôle flottant ne recouvre du contenu, sauf « Revenir en bas » du chat. Les actions équivalentes reprennent les mêmes libellés.

## 6. Contrat du chat

L’envoi affiche immédiatement la question, l’état de préparation et Arrêter avant les attentes d’historique. Un verrou synchrone empêche les doubles envois. Arrêter ou changer de conversation invalide les résolutions tardives.

L’anneau existant conserve son modèle de phases, mais n’affiche pas de pourcentage supposé : réflexion par défaut, recherche uniquement sur signal web/source reçu, rédaction sur texte ou recherche terminée. Libellé aria-live poli ; compteur hors de la région annoncée. Indicateur statique, compatible reduced-motion. Une longue attente est expliquée sans promettre une archive à l’invité.

Seul le bloc Markdown ouvert est reparsé à chaque fragment. Les blocs clos sont mémorisés ; tableaux/fences incomplets sont retenus. Les sections structurées sont ajoutées à la fin. Les anciennes réponses chargées depuis l’historique gardent le parseur existant. Copier, Régénérer et Exporter suivent une réponse terminée, visibles au survol/focus desktop et en permanence tactile.

Règles vérifiées (revue finale 2026-09) : un titre de section est reconnu même décoré (`### SOURCES`, `**SOURCES**`, `SOURCES :`) ; les relances étudiantes et leur ligne `[1] + [2] + [3]` sont extraites du texte entier (le format v4 les place après SOURCES) et n’apparaissent qu’une fois, en propositions ; une liste numérotée reste ouverte tant que la ligne suivante peut être ce marqueur, elle n’est donc jamais close puis retirée ; le marqueur n’est jamais affiché. Le bloc ouvert ne montre jamais de syntaxe partielle (lien, parenthèse d’appel de note, gras, code, titre de section, commentaire). Les liens sont numérotés par un registre unique par réponse, identique en direct et à la relecture ; il repart à zéro à la régénération.

Les outils du composer sont à gauche ; Envoyer/Arrêter à droite. Arrêter ignore un clic dans les 500 ms qui suivent l’envoi : le second clic d’un double clic tombait sur Arrêter et coupait la réponse. Le suivi automatique reste actif tant que l’utilisateur est en bas. Une remontée suspend le suivi, y compris avant que l’événement de défilement (limité à 80 ms) soit traité : la position réelle du fil est relue avant chaque suivi. Une zone de lecture qui s’agrandit (fenêtre agrandie, bandeau qui disparaît) abaisse la position sans geste de l’utilisateur : seule compte donc la distance au bas mesurée avant la croissance du contenu. Le retour explicite respecte reduced-motion.

La reprise compare le tour, la question et le contenu, puis vérifie que conversation et génération sont encore courantes après l’attente réseau. Les nouvelles vérifications d’archive sont bornées. L’archivage serveur et le protocole API restent inchangés.

Limites : le flux courant désactive les parts de source par défaut (`sendSources` SDK). L’interface sait recevoir ces parts, sans activer l’API ni inventer de sources. Aucun archivage invité ajouté. Une garantie de reprise réseau et les seuils de performance exigent des mesures réelles ; les tests purs ne les démontrent pas.

## 7. Mouvement et accessibilité

Transitions fonctionnelles 120–320 ms, ease-out, aucun rebond. Reveal est statique par défaut ; une animation exige une intention explicite. Une View sentinelle reste nécessaire pour IntersectionObserver web, distincte d’Animated.View.

Focus visible 2 px, décalé de 3 px ; navigation clavier complète. Contraste visé 4,5:1 texte et 3:1 limites de contrôle. Les séparateurs décoratifs ne sont pas des limites interactives. Icônes de la famille existante via `iconPaths.ts` et `icons.web.tsx`. Aucun ajout de dépendance de production.

## 8. Réglementaire

Conserver les textes canoniques de `src/compliance/disclosures.ts`, la mention « système d’intelligence artificielle », les avertissements médicaux et les urgences 15/112. Les sources ne sont jamais verrouillées par l’abonnement. Aucun diagnostic ni conduite à tenir individualisée introduit. RoleGate, contrôles serveur et politiques d’accès restent intacts.

## 9. Vérification et suivi

Inventaire et contrats par écran dans `docs/audits/2026-09-premium/screen-contracts.md`. Captures 390/768/1024/1440, reduced-motion, axe et journaux de typecheck/test:unit/build web accompagnent la PR. Le tableau de livraison distingue implémenté, observé et non vérifié. Aucun score Lighthouse, p75 Core Web Vitals ou résultat sur appareil natif n’est annoncé sans mesure correspondante.
