# ADR-0047 — Direction créative « Moniteur » : accueil vivant, mouvement orchestré, espace connecté

- Date : 2026-10-26
- Statut : Accepted — demande de Hugo (« refonte créative ambitieuse, vivante, premium, jeune, immersive et mémorable,
  cinq itérations autonomes »), décisions créatives déléguées ; validation visuelle finale par Hugo sur la PR
- Portée : accueil (`app/index.tsx`, `src/ui/landing/`), design system (tokens, mouvement), Vue d'ensemble, barre
  latérale, état vide du chat, en-tête des tableaux de réponse, pages d'outil publiques
- Remplace partiellement : ADR-0040 §« Aucun effet continu » et 05_DESIGN §1 (« ni dégradé, ni halo ») pour les
  SURFACES DE PRÉSENTATION seulement. Les zones de lecture médicale restent sobres.

## Contexte

L'accueil ADR-0041 était propre mais uniforme : bandeau bleu brume, trois cartes d'audience identiques, liste de dix
outils, bloc bleu nuit, FAQ. Rien ne le distinguait d'un gabarit SaaS : composition symétrique, cartes de même poids,
aucun mouvement en dehors d'un tracé ECG discret, aucune démonstration du produit. Le dashboard reprenait des cartes
blanches identiques ; le chat présentait un état vide neutre, sans identité d'assistant.

Contraintes conservées : premier message gratuit sans inscription ; trois profils et leurs droits réels
(`featureVisibility.ts`, RoleGate, autorisation serveur) ; mentions réglementaires canoniques (disclosure IA, 15/112,
pied de site) ; aucun chiffre d'usage, avis ou fonctionnalité inventés ; pré-rendu sans fenêtre (hydratation) ; aucune
dépendance ajoutée ; prefers-reduced-motion.

## Décision : « Moniteur »

Une identité tirée de ce que le logo dessine déjà (croix, tracé ECG, pistes de circuit terminées par des nœuds) et de
l'instrument que tout étudiant en santé connaît : le moniteur de surveillance et son papier millimétré.

1. **Premier écran bleu nuit (#141E4E)** sur papier millimétré d'ECG (1 mm / 5 mm, masqué en dégradé radial : effet
   localisé, jamais un fond uniforme), halo bleu électrique localisé derrière la photographie. Grand titre en Source
   Serif 4, fluide jusqu'à 96 px, mots révélés de sous un cache (`lx-w`) : « Une question de santé, *trois niveaux de
   réponse.* » (fait du produit : trois assistants). Le tracé est **balayé comme sur un moniteur** (nouvelle courbe
   derrière une barre lumineuse, ancienne effacée devant elle) puis **se ramifie en trois pistes** terminées par les nœuds
   du logo, aux couleurs des trois assistants. La photographie monte sur le tracé et se révèle derrière une barre de
   balayage ; une carte « trois lectures » montre la même question expliquée pour chaque profil (forme de la réponse,
   pas une réponse clinique), avec segments d'avancement.
2. **Trois assistants** : vrai jeu d'onglets WAI-ARIA (flèches, Début/Fin), repère coulissant, fond de section qui
   change de teinte d'audience, photographie et aperçu de réponse propres à chaque profil, outils du profil issus
   d'`APP_FEATURES`, condition d'accès réelle (visiteur : essai d'un message ; compte public : « Demander l'accès » vers
   `choose-role` ; outil non ouvert au compte : puce inerte avec cadenas).
3. **Au-delà du chat** : défilement narratif ponctuel. Sur ordinateur, cinq chapitres (chat sourcé, ECOS, QCM EDN,
   présentations, révisions) défilent à gauche et un écran collant montre l'aperçu du chapitre au milieu de la fenêtre ;
   sous 1 024 px, chaque chapitre porte son aperçu. Les aperçus reprennent les libellés et les badges de source réels
   (`SourceBadgePill`) et portent tous « Contenu fictif » (écran et lecteurs d'écran).
4. **Qui accède à quoi** : sommaire des outils en tableau outils × profils, dérivé du registre de visibilité. Remplace
   la liste de cartes et dit honnêtement ce qui est réservé à qui.
5. **Méthode** : le déroulé des étapes tel que le chat l'affiche (analyse, recherches et requêtes exactes, domaines
   consultés, rédaction), allumé étape par étape, puis les trois éléments de confiance existants et une limite explicite.
6. **Appel final** bleu électrique, tracé blanc qui défile ; FAQ inchangée (miroir du JSON-LD), avec 15/112 en tête.
7. **Espace connecté** : bandeau « moniteur » de la Vue d'ensemble (relevés sur fond de nuit, tracé menthe lumineux),
   carte « Chat » large qui porte les trois chatbots (les puces séparées doublaient la carte), cartes d'outils en relief
   au survol, entrées échelonnées limitées aux blocs et aux résultats qui arrivent ; barre latérale à icônes nues et
   filet bleu vif sur la page courante ; état vide du chat signé par un battement à la couleur de l'assistant ; en-tête
   des tableaux de réponse en encre sur bleu brume (l'aplat bleu vif pesait plus que les données) ; pages d'outil
   publiques sur le même bandeau.

## Mouvement : règles

- `transform` / `opacity` pour tout ce qui boucle ; `clip-path` réservé aux révélations ponctuelles et au balayage ;
  aucune propriété de mise en page animée en boucle.
- Chaque état final d'animation est un état lisible : sous prefers-reduced-motion (règle globale), tout apparaît à sa
  place ; les éléments en boucle (cycle des lectures, balayage, nœuds) sont figés sur leur premier état utile.
- Bouton **« Figer »** dans le premier écran (WCAG 2.2.2 : mouvement automatique de plus de 5 s) : suspend toutes les
  animations de la page ; masqué sous reduced-motion (rien à figer).
- Animations du premier écran suspendues hors de la fenêtre (`data-off`) ; aperçus joués seulement à leur entrée.
- Profondeur au pointeur (souris uniquement) : photo et carte se décalent de quelques pixels en sens opposés ; une
  écriture de variable CSS par image, aucun état React.
- Détails liés au défilement (`animation-timeline: view()`) seulement dans les navigateurs compatibles ET sans
  préférence de réduction ; ailleurs, les éléments sont simplement affichés.

## Conséquences

- Nouveaux tokens `colors.night` et `personasOnNight` (contrastes ≥ 4,5:1 vérifiés par `design-tokens.test.ts`),
  `type.hero`. CSS de l'accueil injecté dans la page (`LandingStyle`), CSS de l'espace dans le `<head>`
  (`src/ui/appMotion.ts`). Aucune dépendance, aucun changement d'API, de base, d'autorisation ni de prompt.
- La photo « bibliothèque » (`study*`, Pexels, déjà livrée et licenciée) est réaffichée dans l'onglet Étudiants.
- Tests : `landing-editorial.test.ts` réécrit pour les invariants de la direction (mentions, aperçus fictifs, outils
  dérivés du registre, typographie française, « Figer » et reduced-motion) ; contrastes de nuit testés.
- Limites : aucune mesure Lighthouse/Core Web Vitals ni appareil réel ; le mouvement est vérifié par captures en
  navigateur Chromium (Playwright), pas sur Safari iOS. Le défilement narratif repose sur IntersectionObserver.

## Addendum 2026-10-26 : extension à toutes les pages et à tous les outils (demande de Hugo)

Composant partagé `NightBand` (`src/ui/NightBand.tsx`) et option `band` de `Screen`. Appliqué à
l'en-tête desktop des huit outils (`ToolScreenHeader`), au dashboard ECOS, au panneau admin, aux
pages légales, marketing (dont l'article de blog : retour, catégorie, titre, chapeau, date), à la
404, à la connexion et au mot de passe, au compte, au choix du rôle (cartes sans filet coloré) et
aux tarifs. Chaque écran garde UN titre de niveau 1 (vérifié sur 21 écrans × 2 largeurs, visiteur
et compte connecté) ; axe-core : 0 violation sur les pages converties. Zones de travail et de
lecture inchangées (fil du chat, simulation ECOS, intérieur des outils autonomes).
Le tracé des bandeaux (pages de contenu et Vue d'ensemble) se dessine une seule fois puis reste
affiché (`EcgTrace once`) : aucune animation continue hors de l'accueil, qui seul porte « Figer ».
Repère des outils = leur audience réelle (`src/ui/audienceLabel.ts`) ; l'écran d'accès réservé
(RoleGate) adopte la même carte.

## Suivi

- Validation visuelle par Hugo ; mesure de performance réelle (INP, CLS) après déploiement en recette.
- Seconde itération possible : vraies captures du produit en remplacement des aperçus, photographie de simulation
  clinique sous licence, déclinaison « Moniteur » des pages Tarifs, Blog et Connexion.
