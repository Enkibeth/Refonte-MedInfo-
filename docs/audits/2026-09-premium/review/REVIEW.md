# Revue finale Claude — direction A

27 septembre 2026. Base de revue : `integration/refonte-premium` (`302ea19`, PR #149)
+ fusion de `main` (`780d7a4`). Branche de revue : `claude/medinfo-vercel-hostinger-bxicwg`.
Périmètre strictement UI : aucune modification de prompt, route API, logique serveur,
base, RLS, autorisation, script de build ni hébergement.

## Résumé

La direction A est conservée telle quelle : l’état final des écrans est identique au pixel
près avant et après cette revue (0,00 % d’écart sur le chat, ≤ 0,19 % sur l’accueil). La
revue a porté sur ce que les captures ne montraient pas : le comportement du chat
pendant le flux, les interruptions, le défilement, le premier affichage des pages et
l’accessibilité des états. Elle a trouvé et corrigé huit défauts réels, dont trois qui
touchaient directement l’utilisateur du chat : un double clic sur « Envoyer » coupait la
réponse (et consommait l’essai invité sans réponse), une remontée dans le fil pendant un
flux rapide était annulée (surtout sur mobile), et le format réel des réponses de GPT-6
Luna (`### SOURCES`, relances après SOURCES) s’affichait en partie en texte brut. Côté web,
toutes les pages subissaient une erreur d’hydratation React (#418), déjà présente en
production, qui masquait un saut de mise en page au premier affichage sur ordinateur ;
les deux sont supprimés.

Ce qui n’est **pas** démontré : les parcours connectés par rôle et la reprise avec archive
réelle, faute de comptes de test autorisés (aucune session n’a été simulée). Le chat réel
a été vérifié en invité sur l’aperçu Vercel de la branche (GPT-6 Luna) : rendu, relances,
suivi du fil et arrêt conformes.

## Défauts constatés et corrections

| # | Constat (preuve) | Correction | Vérification |
|---|---|---|---|
| 1 | Numérotation des liens repartant à 1 dans chaque bloc du flux et chaque section relue : direct [1,1,1] ≠ relecture | Registre de notes unique par réponse, remis à zéro à la régénération (`AssistantBlocks`, `MarkdownRenderer`) | Test de rendu `chat-answer-render.test.ts` : [1,2,3] en direct, [1,2,3,1] à la relecture ; banc : aucune renumérotation |
| 2 | Réponse étudiante réelle (GPT-6 Luna) : `### SOURCES` non reconnu → sources et relances en texte brut ; au format prompt v4, relances **après** SOURCES avalées par la section, boutons jamais affichés | Titres de section tolérants (`###`, `**…**`, `:`), relances extraites du texte entier, marqueur orphelin retiré (`parseAssistantMessage.ts`) | 8 tests parseur ; rendu : 3 propositions, une seule fois |
| 3 | Pendant le flux : marqueur `[1] + [2] + [3]` affiché brut, syntaxes partielles visibles (parenthèse d’appel de note, lien, titre de section décoré, commentaire, puce) | Découpe append-only : liste de relances gardée ouverte jusqu’au marqueur, jamais close puis retirée ; bloc ouvert sans syntaxe partielle (`streamingBody.ts`) | Invariants vérifiés à chaque caractère sur 4 formats ; équivalence direct/relecture ; 11 tests échouaient sur l’ancienne découpe |
| 4 | Double clic sur « Envoyer » : le second clic tombait sur « Arrêter », réponse coupée, essai invité consommé | Arrêt ignoré 500 ms après l’envoi ou la régénération | Banc : 1 requête, 1 bulle, réponse complète |
| 5 | Remontée du fil annulée pendant un flux rapide : `onScroll` limité à 80 ms, contenu grandissant toutes les ~30 ms | Seul un geste vers le haut suspend le suivi ; position réelle relue avant chaque suivi ; l’arrêt exige que le fil ait été loin du bas **avant** la croissance (une zone de lecture agrandie abaisse la position sans geste) ; contenu qui rétrécit ignoré | Banc 390 et 1440 : position de lecture tenue pendant que le fil grandit, retour en bas puis suivi jusqu’à la fin ; fenêtre agrandie 7 fois pendant le flux : suivi conservé |
| 6 | Erreur React #418 à l’hydratation sur accueil, chat, tarifs, blog (**aussi en production actuelle**) ; sur ordinateur, premier affichage en mise en page mobile puis saut | Largeur lue via `useWindowWidth` (valeur du pré-rendu pendant l’hydratation) ; préférences locales, détection de la dictée et `?mode=signup` via `useClientState` ; bascules de mise en page de l’accueil, de la navigation publique, de l’en-tête du chat et de la barre d’onglets en CSS de pré-rendu (`src/ui/responsive.ts`) ; hauteurs de ligne fixes de l’en-tête du chat ; place du sélecteur de chatbot réservée pendant l’amorçage ; micro de dictée réservé aux sessions connues | 0 erreur sur 28 routes × 2 largeurs × avec/sans préférences ; écart premier affichage → état final de l’accueil : 10–14 % → ≤ 0,11 % des pixels |
| 7 | `accessibilityState` ignoré par react-native-web 0.21 : 26 éléments sans `aria-checked`/`aria-selected`/`aria-disabled`/`aria-expanded` sur le web ; choix uniques exposés comme simples boutons ; arrêt de tabulation parasite | Props ARIA directes ; choix uniques en `radio` + `aria-checked` ; lien actif du shell en `aria-current="page"` ; zone de survol hors tabulation | axe sur le chat après réponse : 0 violation ; `aria-checked`/`aria-selected` présents ; `aria-expanded` sur Outils et Pays |
| 8 | Article de blog : `<title>` vide pendant le chargement et dans le pré-rendu (axe `document-title`, sérieux) ; CV : barre d’outils débordant de 20 px à 1024 px, « ⋯ » inatteignable ; libellé « 1 actifs » | Titre de repli ; libellés courts jusqu’à 1199 px ; accord | axe 0 violation ; aucun débordement de 1024 à 1280 px |

## Résultats

Banc local : export `npm run build:web` inchangé, seul `/api/chat` remplacé par un flux SSE
synthétique non médical, autres API en 503, Supabase coupé. Chromium sans tête (Playwright
1.56.1). Scripts et mode d’emploi : [`harness/`](harness/README.md).

### Chat (invité, 15 scénarios) — [rapport](chat/chat-bench.json)

| Scénario | Résultat mesuré |
|---|---|
| Premier envoi (3 chatbots) | Attente et Arrêter en 29–42 ms ; premier texte au délai de la fixture ; 0 déplacement de bloc clos ; 0 syntaxe brute ; notes [1,2,1] (lien répété) ; 3 / 5 / 2 propositions |
| Double clic | 1 requête, 1 bulle, réponse complète |
| Arrêt avant le premier fragment | Aucun message fantôme ; note invité sans promesse d’archive ; flux fermé côté serveur |
| Arrêt pendant le flux | Texte conservé (215 caractères) et figé ; actions disponibles |
| Coupure réseau puis Réessayer | Bandeau d’erreur ; une seule réponse finale, complète ; requête avec 1 message utilisateur |
| Nouvelle conversation pendant l’attente | Fil vide ; l’ancien flux n’écrit jamais dans le nouveau |
| Régénération | Une seule réponse pendant et après ; texte final identique ; numérotation repartie à zéro |
| Défilement 1440 et 390 | Suivi en bas ; remontée tenue (position 746 / 217 px stable pendant la croissance) ; « Revenir en bas » puis suivi jusqu’à la fin |
| Zone de lecture agrandie pendant le flux, 1440 et 390 (7 agrandissements de la fenêtre) | Suivi conservé : distance au bas 0 pendant le flux, pas de « Revenir en bas », 0 en fin de réponse |
| Onglet masqué puis visible | Flux terminé, aucune erreur, aucun doublon |
| Mouvement réduit (émulation Chromium réelle) | `prefers-reduced-motion` actif ; aucune animation en cours pendant l’attente ni le flux |

Captures du banc : [`chat/`](chat/) (flux, fin, arrêt, coupure, défilement, mouvement réduit,
réponses des 3 chatbots à 390 et 1440).

Relecture adverse finale du diff : le correctif 5 pouvait prendre pour une remontée la
position abaissée par le navigateur quand la zone de lecture s’agrandit alors que le fil
est en bas, si l’événement de défilement n’était pas encore traité. Non reproduit dans
Chromium avant correction (0 arrêt du suivi sur 380 agrandissements, flux de 200 à 1 300 caractères/s,
avec et sans ancrage de défilement `overflow-anchor`), mais la condition ne dépendait que
du minutage : elle se fonde désormais sur la distance au bas avant la croissance. Banc
complet rejoué sur le build final (15/15, résultats des 13 scénarios antérieurs
identiques). Captures, axe, clavier, hydratation et mesures proviennent du build
précédent, au rendu identique (seule la condition d’arrêt du suivi a changé).

### Chat réel (aperçu Vercel de la branche, invité) — [rapport](chat/real/real-chat.json)

Build Vercel du commit de revue, `/api/chat` réel (GPT-6 Luna, recherche web), un message
par contexte de navigateur (essai invité, parcours public normal). Questions d’information
générale ; les réponses du modèle ne sont pas relues médicalement et ne sont montrées que
pour le rendu. Captures : [`chat/real/`](chat/real/).

| Essai | Résultat mesuré |
|---|---|
| Étudiant, 390 px | Attente affichée en 25 ms ; premier texte à 8,1 s, fin à 17,1 s ; 5 503 caractères, 24 blocs clos, 0 déplacement ; aucune syntaxe brute (marqueur de relances, `(SRCn)`, `###`, commentaire) ; 3 relances en propositions ; fil suivi jusqu’en bas ; décalage cumulé après l’envoi 0,004 ; 0 erreur console |
| Grand public, 1440 px | Attente en 27 ms ; premier texte à 7,0 s, fin à 10,5 s ; notes 1, 2, 3 ; 6 propositions ; aucune syntaxe brute ; décalage 0,0009 ; 0 erreur |
| Arrêt pendant le flux, 390 px | 1 333 caractères à l’arrêt, identiques 4 s plus tard ; note « Lecture interrompue. Le texte déjà reçu reste affiché dans cet onglet. » (aucune promesse d’archive) |

Le délai du premier texte (7–8 s) vient du modèle (raisonnement et recherche web), hors
périmètre UI ; l’attente est affichée immédiatement.

### Écrans, axe, clavier

- [128 captures](captures/) (32 écrans × 390/768/1024/1440, dont les 4 éditeurs autonomes) :
  **0 violation axe** (WCAG 2 A/AA, 2.1, 2.2 AA), 0 débordement horizontal, 0 erreur
  d’hydratation — [rapport](captures/captures.json). Les routes protégées montrent leur
  barrière réelle pour un invité.
- Chat après réponse (propositions cochées, sources ouvertes), 3 chatbots × 390/1440 :
  0 violation — [rapport](chat/axe-chat.json).
- Clavier ([rapport](chat/keyboard.json)) : ordre de tabulation logique ; menus Outils et
  Pays et fiche de source ouverts à l’Entrée, focus déplacé dedans, fermés à Échap, focus
  rendu au déclencheur.

### Premier affichage et performances (labo, médiane de 3)

Même banc pour la base (`302ea19`) et la revue ; mobile = 390 px avec CPU ralenti ×4,
desktop = 1440 px sans ralentissement ; polices Google via le proxy de l’environnement.
Rapports : [base](metrics/metrics-base-302ea19.json), [revue](metrics/metrics-review.json),
[matrice d’hydratation](metrics/hydration-matrix.txt).

| Profil | Page | LCP base → revue | CLS base → revue | Erreurs #418 base → revue |
|---|---|---:|---:|---:|
| mobile | accueil | 472 → 460 ms | 0,003 → 0,003 | 0 → 0 |
| mobile | chat | 2 064 → 372 ms | 0,236 → 0,158 | 3/3 → 0 |
| mobile | connexion | 1 904 → 1 888 ms | 0,021 → 0,021 | 0 → 0 |
| mobile | tarifs | 340 → 380 ms | 0,001 → 0,001 | 0 → 0 |
| desktop | accueil | 564 → 424 ms | 0,001 → 0,001 | 3/3 → 0 |
| desktop | chat | 524 → 328 ms | 0,031 → 0,004 | 3/3 → 0 |
| desktop | tarifs | 452 → 344 ms | 0 → 0,045 | 3/3 → 0 |
| desktop | blog | 344 → 332 ms | 0 → 0,0003 | 3/3 → 0 |

Lecture : l’erreur #418 faisait reconstruire toute la page ; les éléments recréés ne
comptent pas comme « décalés », ce qui masquait le saut visible. Corriger l’hydratation
sans corriger la mise en page aurait fait monter le CLS desktop à 0,42–0,71 : d’où les
règles CSS de pré-rendu. Tarifs desktop (0,045, zone « bon ») : l’en-tête natif de la pile
est masqué après hydratation au-delà de 1024 px — non traité, voir arbitrages. Les FCP
isolés varient fortement sous ralentissement CPU (ex. connexion mobile) ; seuls LCP, CLS
et les erreurs sont interprétables ici. Aucune donnée terrain p75, ni Lighthouse.

Poids JS exporté (9 fichiers, gzip -9, même méthode) : base 6 950 147 o / 1 865 484 o,
revue 6 957 092 o / 1 867 903 o (+2,4 Ko gzip, +0,13 %, fusion de `main` comprise).

### Tests et contrôles

`npm run typecheck` réussi ; `npm run test:unit` : 60 fichiers, **833 tests** (+32), aucun
supprimé ni affaibli ; `npm run build:web` réussi. Nouveaux tests : parseur (formes
réelles), découpe du flux (invariants à chaque caractère, équivalence direct/relecture),
rendu réel du composant via react-native-web (`chat-answer-render.test.ts`), hooks
d’hydratation (`hydration-hooks.test.ts`). Contrôle inverse : 11 tests de découpe et 4
tests de rendu échouent sur l’ancien code ; le test des hooks échoue si un hook lit le
navigateur au pré-rendu.

## Non démontré — blocages

1. **Parcours connectés par rôle** (étudiant, professionnel, admin), archive serveur,
   reprise après veille avec archive réelle, historique : aucun compte de test autorisé
   n’est disponible dans cette session. Aucune session n’a été fabriquée et aucun contrôle
   (RoleGate, rôles, RLS) n’a été contourné. Il faut un compte par rôle, sans donnée
   patient, fourni par les secrets de l’environnement (jamais dans la conversation).
2. Chat réel **connecté** (archive, historique, reprise après veille avec archive, trois
   chatbots pour un compte vérifié) : dépend des comptes de test (blocage 1). Le chemin
   invité est vérifié sur l’aperçu (ci-dessus).
3. Lighthouse, p75 terrain, appareils natifs iOS/Android, clavier virtuel et lecteur
   d’écran réel : non mesurés.

## Restes connus (non corrigés, proposés)

- Chat mobile, CLS 0,158 : arrivée des polices (retour à la ligne de la description de
  l’état vide), pastille « Essai gratuit » et barre d’onglets invitée qui disparaît à la
  résolution de la session. Piste : indice de session posé avant le premier affichage
  (script en tête) pour choisir la variante invité/connecté dès le pré-rendu ; polices
  auto-hébergées ou métriques de repli.
- Logo de l’en-tête public absent du pré-rendu (Image react-native-web chargée après le
  JS) : apparition sans décalage (taille fixe).
- Tarifs/compte : l’en-tête natif de la pile dépend de la largeur (0,045 desktop).

## Arbitrages réservés à Hugo

1. Comptes de test par rôle pour terminer la vérification connectée (voir blocage 1).
2. `sendSources` dans l’API, garantie d’archive invitée, terminologie « aide à la
   décision » : inchangés, toujours en attente.
3. Tarifs/compte sur mobile web : l’en-tête natif répète le titre de la page ; le garder
   (retour en haut) ou le retirer au profit du lien de retour de la page.
4. Chantier de performance du premier affichage (indice de session, polices) : à
   décider séparément, hors de ce lot UI.
