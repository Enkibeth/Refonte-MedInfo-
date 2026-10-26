# MedInfo AI — Design System v2

Version 3.0, 26 octobre 2026 (direction créative « Moniteur », §14). Direction A « Bureau de référence » pour les zones de lecture et de travail ; couche expressive « Moniteur » pour les surfaces de présentation (accueil, bandeaux de l’espace connecté, pages d’outil publiques).
Source exécutable : `src/ui/tokens.ts`. Décisions : ADR-0038, ADR-0040, ADR-0041, ADR-0043 et ADR-0047. Web prioritaire ; variantes natives conservées.

## 1. Principes

Une interface de lecture et de travail, plus chaleureuse. Papier ivoire, bleu brume, encre nette, bleu vif pour agir. Des touches sauge, lilas et argile servent de repères ; le blanc reste réservé aux surfaces de lecture et de travail. La composition éditoriale alterne sections claires et bandeaux bleu nuit. Ni verre, ni emoji/icône étincelle, ni grille uniforme de cartes. Les références, dates et niveaux de preuve sont ceux effectivement disponibles ; aucune garantie de vérification universelle.

**Deux registres (ADR-0047).** La *lecture* (réponses du chat, articles, formulaires, outils) reste sobre : surfaces claires, aucun halo, aucun mouvement continu. La *présentation* (accueil, bandeau de la Vue d’ensemble, pages d’outil publiques) adopte la couche « Moniteur » (§14) : bleu nuit, papier millimétré d’ECG, halos bleus localisés, tracés lumineux, mouvement orchestré. Un dégradé ou un halo n’y est permis que localisé et motivé (profondeur derrière un objet, signal), jamais comme fond uniforme ni en dégradé violet-bleu.

## 2. Tokens sémantiques

| Usage | Token | Valeur web |
|---|---|---|
| Page / papier | background | #F8F7F3 |
| Lecture / formulaires | surface | #FFFFFF |
| Navigation, surfaces secondaires | surfaceAlt | #EDF1F7 |
| Premier écran | editorial.hero | #E8EFFA |
| Section sources | editorial.ink | #172E46 |
| Texte sur bleu nuit | editorial.onInk / onInkMuted | #F4F7FC / #C7D5E3 |
| Encre | text | #142034 |
| Texte secondaire | textMuted | #526174 |
| Accent texte, focus | accent | #0052D6 |
| Action primaire | accentVivid | #0067FF |
| Séparateur | border | #D8DFE7 |
| Limite interactive | borderStrong | #7D8998 |
| Avertissement | warningText / warningBackground | #80500C / #FBF1DD |
| Succès | success / successBackground | #12744A / #E6F4EC (5,1:1) |
| Champ enfoncé, désactivé | surfaceSunken | #DFE5EE (distinct de surfaceAlt) |

Les audiences ont trois repères stables : sauge pour le public, lilas pour les étudiants, bleu pour les professionnels. Les pastilles d’outils reprennent les mêmes associations dans l’accueil, le dashboard et les menus via `featureTint`. Ces couleurs ne sont pas des statuts : les noms et icônes restent présents. Succès, erreur et avertissement conservent leurs tokens sémantiques dédiés, avec texte/icône. La section sources sombre est une composition éditoriale locale, pas un mode sombre global.

Espacement : 4, 8, 12, 16, 24, 32, 48, 64. Rayons : 4/6/8/12 ; pilule réservée aux petits états. Contrôles : minimum 44 px de hauteur et de largeur pour une icône. Bordure 1 px ; filet éditorial 3 px. Les cartes de contenu n’ont pas d’ombre ; seules les surfaces superposées peuvent avoir une ombre discrète.

## 3. Typographie

Source Serif 4 : titres de page, accroche et sections éditoriales. Schibsted Grotesk : titres d’interface, navigation et actions. Inter : corps, aides et champs. JetBrains Mono : identifiants et valeurs techniques déjà présentes.

Expo web et les quatre outils HTML chargent la même feuille locale `public/vendor/fonts/fonts.css`. Inter et Schibsted Grotesk 400–700 sont incluses, avec licences OFL ; Source Serif 4 et JetBrains Mono réutilisent les fichiers existants. Aucune requête Google Fonts au chargement. Les polices des documents exportés gardent leur logique propre.

| Niveau | Taille / interligne |
|---|---|
| Accueil large | 60 / 68 |
| Display compact | 40 / 46 |
| Page | 32 / 40 |
| Section UI | 22 / 30 |
| Sous-section | 18 / 26 |
| Introduction | 17 / 27 |
| Lecture longue (réponses, articles) | 16 / 26 (`type.reading`) |
| Champ de saisie | 16 / 24 (`type.input`, jamais moins au doigt) |
| Corps | 15 / 24 |
| Contrôle | 14 / 20 |
| Note | 13 / 20 |

Un h1 par page, puis h2/h3 selon la structure. Titre de page : serif en graisse normale (`PageTitle`, sans filet vertical) ; deux titres de même rang ont la même famille, la même taille et la même graisse. Paragraphes bornés à `layout.measure` (≈ 75 caractères). Titres équilibrés et paragraphes sans orphelin (`text-wrap-style`). Chiffres tabulaires pour les colonnes alignées (heures, scores). Pas de capitales systématiques. Aucun blocage de zoom ou de mise à l’échelle native. Les libellés peuvent passer à la ligne.

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

## 5 bis. Boutons et états d’interaction (révision 2026-10)

Un seul jeu de primitives ; aucun contrôle fait main ne réinvente une couleur de survol.

| Primitive | Usage | Contrat |
|---|---|---|
| `Button` (`src/ui/Button.tsx`) | Toute action textuelle | Primaire bleu vif (ombre de contact 1 px) ; secondaire blanc, filet `borderControl`, libellé encre ; fantôme bleu ; danger contour rouge. Survol plus dense, appui encore plus dense (`accentVividPressed`) — jamais d’atténuation d’opacité. Désactivé neutre (fond `surfaceSunken`, libellé atténué, sans ombre). Chargement : couleur, libellé et taille conservés. `lg` = 48 px, `md` = 44 px, libellé Schibsted Grotesk demi-gras. `accessibilityRole="link"` quand le bouton ouvre une page ou une source. |
| `Touchable` (`src/ui/Touchable.tsx`) | Ligne, carte, puce ou bouton composé | Remplace `TouchableOpacity` (interdit, test `interaction.test.ts`) : plus de flash à 20 %. Web : couche d’état CSS (`INTERACTION_CSS`, `src/ui/interaction.ts`) qui épouse l’arrondi — encre 5 % au survol, 10 % à l’appui ; `feedback="light"` sur fond sombre, `"link"` pour un lien textuel (souligné), `"none"` si le composant gère ses états. Natif : opacité 0,7 à l’appui. |
| `Chip` / `ChipRow` (`src/ui/Chip.tsx`) | Choix et filtres | Pilule blanche à filet clair ; sélection = fond bleu très léger, filet et libellé accent + coche (jamais la couleur seule). `role` radio / checkbox / button et état annoncé. 36 px au pointeur fin, 44 px au doigt (`@media (pointer: coarse)`). |
| `SearchField` (`src/ui/SearchField.tsx`) | Recherche | Un seul cadre (loupe, saisie, « Effacer » 44 px) ; le focus colore le cadre et pose l’anneau. |
| `toolbarButtonStyles` (`src/ui/toolbarButton.ts`) | En-têtes d’écran (pays, Outils, plein écran, sources), petites actions sur un résultat | Même langage que le secondaire ; basculé = fond bleu très léger + accent, jamais un aplat plein. |
| `composerButtonStyles` (`src/ui/chat/composerButton.ts`) | Barre du composer | Inchangé (révision du 2026-10-02). |

Règles :
- Une seule action principale par bloc ; les autres en secondaire (fin de station ECOS : « Repasser ce cas » principal, « Retour au dashboard » secondaire).
- Libellé centré verticalement dans toute hauteur imposée : un `minHeight` sans `justifyContent: 'center'` (colonne) ou `alignItems: 'center'` (ligne) laissait le texte collé en haut.
- Actions secondaires d’une ligne (renommer, supprimer) : `mi('reveal-host')` / `mi('reveal')` — repliées à largeur nulle et révélées au survol ou au focus clavier à la souris, toujours visibles au doigt ; jamais masquées aux lecteurs d’écran.
- Contrôles compacts (segments, petites icônes) : `mi('touch44')` → 44 px sur écran tactile.
- Champs : fond blanc et filet `borderStrong` (≥ 3:1), sans fond gris plein.
- Liens textuels `<Link>` : soulignés au survol ; lien mis en forme de bouton : `buttonLinkProps()` (couche d’état ; `'light'` sur fond sombre).
- Typographie des étiquettes : pas d’interlettrage sur un texte en casse normale (`tracking` réservé aux capitales) ; JetBrains Mono réservé aux valeurs techniques (minuteur), jamais aux étiquettes.
- Outils HTML : mêmes filets (`--control-line`), ombre de contact et appui (`--vivid-pressed`) via `public/medinfo-ui.css` et les variables générées.

Contrôle visuel local : `EXPO_PUBLIC_SUPABASE_URL=https://mock.supabase.co EXPO_PUBLIC_SUPABASE_ANON_KEY=mock npm run build` puis `node scripts/design/capture-ui.mjs <dossier>` (session simulée, écrans connectés compris, signalement des contrôles sans nom et des cibles < 44 px sur mobile tactile).

## 6. Contrat du chat

L’envoi affiche immédiatement la question, l’état de préparation et Arrêter avant les attentes d’historique. Un verrou synchrone empêche les doubles envois. Arrêter ou changer de conversation invalide les résolutions tardives.

L’anneau existant conserve son modèle de phases, mais n’affiche pas de pourcentage supposé : réflexion par défaut, recherche uniquement sur signal web/source reçu, rédaction sur texte ou recherche terminée. Libellé aria-live poli ; compteur hors de la région annoncée. Indicateur statique, compatible reduced-motion. Une longue attente est expliquée sans promettre une archive à l’invité.

Seul le bloc Markdown ouvert est reparsé à chaque fragment. Les blocs clos sont mémorisés ; tableaux/fences incomplets sont retenus. Les sections structurées sont ajoutées à la fin. Les anciennes réponses chargées depuis l’historique gardent le parseur existant. Copier, Régénérer et Exporter suivent une réponse terminée, visibles au survol/focus desktop et en permanence tactile.

Règles vérifiées (revue finale 2026-09) : un titre de section est reconnu même décoré (`### SOURCES`, `**SOURCES**`, `SOURCES :`) ; les relances étudiantes et leur ligne `[1] + [2] + [3]` sont extraites du texte entier (le format v4 les place après SOURCES) et n’apparaissent qu’une fois, en propositions ; une liste numérotée reste ouverte tant que la ligne suivante peut être ce marqueur, elle n’est donc jamais close puis retirée ; le marqueur n’est jamais affiché. Le bloc ouvert ne montre jamais de syntaxe partielle (lien, parenthèse d’appel de note, gras, code, titre de section, commentaire). Les liens sont numérotés par un registre unique par réponse, identique en direct et à la relecture ; il repart à zéro à la régénération.

Les outils du composer sont à gauche ; Envoyer/Arrêter à droite. Arrêter ignore un clic dans les 500 ms qui suivent l’envoi : le second clic d’un double clic tombait sur Arrêter et coupait la réponse. Le suivi automatique reste actif tant que l’utilisateur est en bas. Une remontée suspend le suivi, y compris avant que l’événement de défilement (limité à 80 ms) soit traité : la position réelle du fil est relue avant chaque suivi. Une zone de lecture qui s’agrandit (fenêtre agrandie, bandeau qui disparaît) abaisse la position sans geste de l’utilisateur : seule compte donc la distance au bas mesurée avant la croissance du contenu. Le retour explicite respecte reduced-motion.

La reprise compare le tour, la question et le contenu, puis vérifie que conversation et génération sont encore courantes après l’attente réseau. Les nouvelles vérifications d’archive sont bornées. L’archivage serveur et le protocole API restent inchangés.

Limites : le flux courant désactive les parts de source par défaut (`sendSources` SDK). L’interface sait recevoir ces parts, sans activer l’API ni inventer de sources. Aucun archivage invité ajouté. Une garantie de reprise réseau et les seuils de performance exigent des mesures réelles ; les tests purs ne les démontrent pas.

## 7. Mouvement et accessibilité

Transitions fonctionnelles 120–320 ms, ease-out, aucun rebond. Reveal est statique par défaut ; une animation exige une intention explicite. Une View sentinelle reste nécessaire pour IntersectionObserver web, distincte d’Animated.View. Les surfaces de présentation peuvent porter un mouvement orchestré plus long (révélations 0,7–1,4 s, boucles lentes) aux conditions du §14 : `transform`/`opacity` en boucle, état final lisible, bouton « Figer », suspension hors champ.

Focus visible 2 px, décalé de 3 px ; navigation clavier complète. Contraste visé 4,5:1 texte et 3:1 limites de contrôle. Les séparateurs décoratifs ne sont pas des limites interactives. Icônes de la famille existante via `iconPaths.ts` et `icons.web.tsx`. Aucun ajout de dépendance de production.

Structure de page (ADR-0042, vérifiée par axe-core sur 25 écrans × 2 largeurs) : un lien
« Aller au contenu principal » en premier élément tabulable ; en-tête du site = `banner` avec sa
`navigation`, pied = `contentinfo`, contenu dans un seul `<main>` visible (`<MainContent>` ou
`screenMainLayout`, `src/ui/landmarks.tsx`) ; un seul titre de niveau 1 par écran (les outils
autonomes en portent un réservé aux lecteurs d'écran, classe `.sr-only`) ; nom accessible d'un
contrôle = son libellé visible (WCAG 2.5.3) ; navigation entre pages = liens (`aria-current`),
jamais `role="tab"` hors d'un vrai jeu d'onglets ; menus déroulants annoncés `aria-expanded` et
refermés par Échap. Les réponses du chat ne sont pas lues au fil du flux : la bulle de statut
annonce les phases, une région polie annonce « Réponse terminée ».

## 8. Réglementaire

Conserver les textes canoniques de `src/compliance/disclosures.ts`, la mention « système d’intelligence artificielle », les avertissements médicaux et les urgences 15/112. Les sources ne sont jamais verrouillées par l’abonnement. Aucun diagnostic ni conduite à tenir individualisée introduit. RoleGate, contrôles serveur et politiques d’accès restent intacts.

## 9. Vérification et suivi

Inventaire et contrats par écran dans `docs/audits/2026-09-premium/screen-contracts.md`. Captures 390/768/1024/1440, reduced-motion, axe et journaux de typecheck/test:unit/build web accompagnent la PR. Le tableau de livraison distingue implémenté, observé et non vérifié. Aucun score Lighthouse, p75 Core Web Vitals ou résultat sur appareil natif n’est annoncé sans mesure correspondante.

## 10. Photographies de l’accueil (ADR-0039)

Trois scènes réelles d’apprentissage et de travail documentaire ponctuent l’accueil.
Les images accompagnent le propos sans remplacer les liens d’accès aux trois publics
ni les outils. Elles n’illustrent pas une consultation ou un résultat clinique.
Aucun texte de promesse, avis utilisateur ou badge de validation n’est superposé.

Utiliser `LandingPhoto` : textes alternatifs explicites, ratio réservé avant chargement,
WebP adaptatif sur le web, JPEG sur natif. Seule la photo du hero est prioritaire.
Les photos sont servies localement ; provenance et licence dans `assets/landing/README.md`.
Conserver le contenu photographique naturel et les rayons mesurés du design system.

## 11. Rythme et couleurs (ADR-0040)

- Hero bleu brume pleine largeur, photographie sur un passe-partout lilas, filet bleu dans la navigation.
- Trois portes d’entrée sur papier ivoire, avec fonds doux distincts et contours au survol.
- Outils sur fond blanc, pastilles colorées et photographie encadrée de sable.
- Bloc produit/IA/références sur bleu nuit, textes clairs contrastés, accent menthe ; mentions canoniques inchangées dans les emplacements légaux.
- FAQ sur ivoire, questions numérotées et composition en deux colonnes sur grand écran.
- Fond général et surfaces de navigation partagés par les pages existantes ; pages autonomes synchronisées par `scripts/design/sync-web-theme.cjs`.
- Aucun effet continu, aucune dépendance ajoutée, aucun changement de parcours ou d’autorisation.

Hugo confie la recette fonctionnelle finale à Claude Code. Les contrôles visuels de cette itération ne valent pas validation des problèmes d’hydratation et de navigation antérieurs. Reprise : `docs/audits/2026-09-editorial-life/CLAUDE_HANDOFF.md`.

## 12. Présentation du produit et couverture du thème (ADR-0041)

L’accueil met d’abord en avant les trois assistants, les ECOS/révisions et les outils de création. La première photo montre une scène d’études médicales ; son ratio 3:2 conserve les trois personnes. Les photos travail et sources validées par Hugo sont inchangées.

Le long énoncé `INTENDED_PURPOSE` n’est plus recopié dans le bloc commercial de l’accueil. Il reste inchangé dans les CGU, mentions et informations légales. L’accueil conserve la disclosure IA canonique, le footer permanent et la FAQ avec 15/112. Pas de nouvelle promesse clinique, de certification inventée ni de garantie de fiabilité universelle. Les noms de modèles désignent une configuration par défaut de version, pas une garantie sur la configuration administrateur effective.

Les 26 pages applicatives consomment les tokens directement ou via `LegalScreen`; le shell, le dashboard et les menus reprennent les surfaces et pastilles partagées. Les quatre outils autonomes chargent les tokens CSS et la même typographie. Ce constat est une vérification des fondations dans le code, **pas une recette visuelle exhaustive**. Les drapeaux, marques et thèmes de documents/export ne doivent pas être recolorés pour imiter le chrome de l’application.

## 13. Écriture, typographie française et navigation mobile (ADR-0043)

**Écriture.** Pas de tiret cadratin comme incise ou liaison dans un texte affiché : deux-points, virgule, point ou parenthèses (un « — » isolé reste permis comme valeur vide d’un tableau ; verrou `tests/unit/copy-typography.test.ts`). Pas de fragments en série (« Approfondir. Réviser. Comprendre. »), de formules creuses (« une nouvelle façon de… », « donnez forme à ») ni de triades décoratives : une phrase dit un fait du produit. Vouvoiement sur les pages publiques et l’authentification ; les outils étudiants peuvent tutoyer, jamais les deux sur une même surface. Typographie française : espace insécable avant « : » et dans « », espace fine insécable avant ? ! ; et apostrophe ’. Titres d’onglet : « Page | MedInfo AI », moins de 60 caractères.

**Navigation mobile.** Aucune barre d’onglets en bas. Sous 1 024 px, chaque écran de l’espace porte la barre compacte du chat : ☰ à gauche, icône et titre au centre, une action éventuelle à droite. ☰ ouvre la feuille de navigation (outils du rôle, espace, compte, ressources) partagée avec le chat. L’outil occupe tout le reste de la hauteur ; la présentation courte d’un outil n’apparaît que sur ordinateur.

| Brique | Usage |
|---|---|
| `ToolScreenHeader` (`src/ui/ToolScreenHeader.tsx`) | En-tête de tout écran d’outil : barre compacte < 1 024 px, titre + présentation + menu « Outils » au-delà |
| `ScreenNavBar` (`src/ui/AppMobileHeader.tsx`) | Écran qui porte déjà son H1 (Vue d’ensemble, ECOS) : barre compacte sans titre de niveau 1 |
| `NavigationSheet`, `MobileSheet`, `MenuSection`, `MenuRow` | Feuille en bas d’écran, identique au menu du chat |

**Visiteurs.** Une page d’outil montre à un visiteur non connecté sa présentation publique (`src/ui/ToolPreview.tsx`, contenu `src/seo/toolPages.ts`) : en-tête et pied du site, ce que fait l’outil, pour qui, comment y accéder. Elle est rendue dès le pré-rendu ; un navigateur qui avait une session voit l’indicateur de chargement à la place (`src/ui/sessionHint.ts`).

## 14. Direction « Moniteur » (ADR-0047)

L’identité vient de ce que le logo dessine déjà (croix, tracé ECG, pistes terminées par des nœuds) et de l’instrument que tout étudiant en santé connaît : le moniteur de surveillance et son papier millimétré.

**Tokens.** `colors.night` (base #141E4E, deep #0C1438, raised #1E2A63, line #34417A, text #F4F6FF, muted #BCC5E6, signaux mint #5CE1B0, lilac #B9A6FF, blue #7FB0FF) et `personasOnNight` (repère d’audience sur fond sombre : menthe public, lilas étudiant, bleu pro). Texte toujours en `night.text`/`night.muted` ; les signaux servent aux tracés, aux mots accentués des grands titres et aux repères. Contrastes ≥ 4,5:1 testés. `type.hero` : 44/46 au pré-rendu, fluide jusqu’à 96 px par le CSS de l’accueil.

**Motifs.** Papier millimétré (1 mm = 8 px, 5 mm = 40 px), toujours masqué en dégradé radial. Tracé balayé : nouvelle courbe derrière une barre lumineuse, ancienne effacée devant elle. Ramification en trois pistes à nœuds (trois assistants). Révélation d’image par barre de balayage. Numéros de section et d’items en Source Serif 4 italique (« 01 · Trois assistants »).

**Accueil** (`app/index.tsx`, sections `src/ui/landing/`, textes `copy.ts`, CSS `landingCss.ts` injecté par `LandingStyle`) : premier écran moniteur, trois assistants (onglets ARIA), défilement narratif à écran collant, matrice outils × profils, méthode, FAQ, appel final bleu électrique. Les styles JS valent la variante compacte (pré-rendu), le CSS porte les plages ≥ 640/768/1024 et tout le mouvement.

**Aperçus d’interface.** Démonstrations aux contenus fictifs, construites avec les libellés et badges réels (`SourceBadgePill`), signalées « Contenu fictif » dans le cadre et décrites aux lecteurs d’écran (`role="img"`). Une valeur d’exemple (note ECOS, charge de travail) n’existe qu’à l’intérieur d’un cadre signalé. Jamais de chiffre d’usage, d’avis ni de badge de validation.

**Mouvement.** Boucles en `transform`/`opacity` (et `clip-path` pour le balayage) ; chaque état final est lisible ; sous prefers-reduced-motion, tout est affiché à sa place et le bouton « Figer » disparaît ; ailleurs, « Figer » suspend toute animation de la page (WCAG 2.2.2). Animations du premier écran suspendues hors champ (`data-off`), aperçus joués à leur entrée (IntersectionObserver). Profondeur au pointeur réservée à la souris. Détails liés au défilement (`animation-timeline: view()`) seulement si le navigateur les connaît et sans préférence de réduction.

**Espace connecté** (`src/ui/appMotion.ts`, dans le `<head>`) : `ax-night` (bandeau moniteur), `ax-in` (entrée échelonnée, `data-ad`), `ax-lift`/`ax-arrow` (relief au survol). Usage : bandeau et blocs de la Vue d’ensemble, résultats qui arrivent (activité récente, suggestions du chat), cartes d’outils. Pas d’entrée animée sur chaque carte d’une grille.

| Brique | Rôle |
|---|---|
| `lx(names, data?)` (`src/ui/landing/lx.ts`) | `data-mi` + attributs d’état `data-*` (web) |
| `HeroTrace` (.web) | Tracé du moniteur, deux dessins (≥ 768 / < 768) |
| `ReadingCard` | Carte « trois lectures » du premier écran |
| `AudienceSwitcher`, `SectionLabel` | Trois assistants ; repère de section numéroté |
| `Showcase`, `ProductMocks`, `MockParts` | Défilement narratif et aperçus fictifs |
| `AccessMatrix` | Outils × profils, dérivé d’`APP_FEATURES` |
| `MethodSection` | Déroulé des étapes de réponse |
| `useHeroMotion` | Profondeur au pointeur, suspension hors champ |
| `PulseMark` (.web) | Battement de l’état vide du chat |

Contrôle visuel : `CAPTURE_FULL=1` (page entière), `CAPTURE_MOTION=1` (animations actives) et `CAPTURE_WAIT` dans `scripts/design/capture-ui.mjs`.
