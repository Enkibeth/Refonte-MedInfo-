# ADR-0035 — Refonte de l'analyse des partiels (v3)

```yaml
status: Accepted
date: 2026-07-24
owner: Hugo Bettembourg
linked_to: [ADR-0019, ADR-0018, 01_REGULATION §5, 05_DESIGN §6]
supersedes_note: "Fait évoluer la v2 d'ADR-0019 (import + stats + distributions). Le principe fondateur — traitement 100 % client, aucune note envoyée — est INCHANGÉ."
```

## Contexte

L'analyse des partiels est un outil d'appel fort pour les étudiants (elle ne demande
aucun compte payant, aucun modèle, aucune donnée serveur). L'audit de la v2 a révélé
quatre familles de problèmes.

**1. Des chiffres justes affichés d'une manière trompeuse.**
La section « Distributions » ne montrait **pas** la distribution : elle traçait une
**gaussienne théorique** ajustée sur µ/σ, tandis que le curseur affichait un centile
réel. Une promo de médecine est fréquemment bimodale ou tronquée : la courbe mentait
sur la forme. Il n'existait par ailleurs aucun **z-score**, donc aucun moyen de savoir
que 12 dans une épreuve où la promo a coulé vaut mieux que 14 dans une épreuve facile.

**2. Une corruption silencieuse des notes françaises.**
Les fichiers CSV étaient découpés par SheetJS, qui interprète la virgule comme
séparateur de milliers : **« 7,5 » était lu 75**. Une note sur 20 devenait un point
aberrant qui décalait médiane, écart-type et rang de toute la promo. Les accents des
en-têtes étaient également corrompus (aucun décodage UTF-8 explicite).

**3. Un périmètre fonctionnel trop court pour retenir.**
Pas de coefficients (la moyenne était arithmétique non pondérée — irréaliste), pas de
seuil de validation, pas de simulateur, pas de suivi d'une session à l'autre, un
identifiant à saisir exactement sans aucune suggestion, et une seule feuille Excel lue.

**4. Le poids et la forme.**
Les quatre librairies (SheetJS, pdf.js, jsPDF, html2canvas) — **~1,9 Mo** — étaient
chargées d'emblée alors que la plupart des sessions n'ouvrent ni PDF ni export. La page
dupliquait par ailleurs l'en-tête de l'écran natif et imposait trois sections dépliées
puis un bouton « Générer » avant le moindre résultat.

## Décision

Refonte de `public/partiel.html` (page autonome embarquée en iframe, pattern inchangé),
en gardant **100 % du calcul côté client, sans IA, sans réseau, sans base**.

### 1. Un moteur pur, entièrement testé

Tout le calcul vit dans le bloc `@partiel-logic` de la page, extrait et exécuté hors
navigateur par les tests (`tests/unit/helpers/partielLogic.ts`) : ce sont donc les
fonctions **réellement livrées** qui sont vérifiées. Le bloc couvre désormais, en plus
du parsing : quantiles (type 7), écart-type d'échantillon, rang en compétition standard,
centile, z-score, histogramme, pondération, simulation, synthèse, suggestions
d'identifiant, CSV et suivi local.
Suites : `tests/unit/partiel-parse.test.ts` (parsing) et `tests/unit/partiel-engine.test.ts`
(moteur) — **86 tests**, contre 13 en v2, et surtout **le cœur mathématique était
auparavant totalement non couvert**.

L'**import PDF** est couvert à deux niveaux :
- unitaire, sur la chaîne complète items → reconstruction → en-tête → colonne
  identifiant → échelle → statistiques, avec l'exigence que les chiffres soient
  **identiques à ceux du même relevé en CSV** (y compris « 7,5 » et une absence) ;
  plus les cas qui corrompent silencieusement un relevé : cellule manquante (elle
  laisse un trou et ne décale pas les notes suivantes dans la mauvaise épreuve),
  fragments d'une même cellule, pagination, entrées dégénérées ;
- navigateur, sur un **vrai PDF réparti sur deux pages** fabriqué avec le jsPDF
  vendored puis relu par le pdf.js vendored — donc le chemin exact de production,
  décalage `yOffset` inter-pages compris. Le cas du PDF scanné (aucun texte
  sélectionnable) doit produire un message explicite et **aucune analyse**.

Ces tests ont mis au jour un défaut de la reconstruction : pdf.js découpant souvent
un libellé en plusieurs items, une cellule fragmentée créait une **colonne fantôme**
et décalait l'en-tête par rapport aux notes. `mergeLineFragments()` recolle les
fragments dont l'écart est très inférieur à l'écart typique entre colonnes du
document (seuil conservateur, vérifié pour ne pas fusionner des colonnes réellement
rapprochées mais régulières).

### 2. La distribution réelle remplace la gaussienne

`histogramBins()` compte les **effectifs réels** par classe (découpage rond 5/10/20/40
choisi sur ~2√n, déterministe). La loi normale devient une **option décochée par
défaut**, tracée en pointillé, exprimée en effectif attendu par classe et libellée
« repère théorique » — elle ne peut plus être confondue avec les données.

### 3. Lecture des fichiers reprise en main

Les CSV/TSV sont découpés par `parseDelimited()` (détection du séparateur, guillemets,
sauts de ligne échappés, BOM) et `decodeText()` (UTF-8, repli windows-1252) : la
conversion FR revient à `coerceCell`, déjà testé. Conséquence : **« 7,5 » vaut 7,5**, les
accents sont corrects, et **un CSV ne charge plus aucune librairie**. Pour les vrais
classeurs Excel, SheetJS est chargé à la demande, en `raw:true` (jamais la valeur
formatée par le tableur), avec sélection de la feuille la plus dense en nombres.

### 4. Nouvelles fonctionnalités

- **Coefficients** éditables par épreuve, mémorisés localement par signature du jeu
  d'épreuves ; moyenne **et** classement pondérés.
- **Seuil de validation** (10/20 par défaut, déduit de l'échelle) et décompte des
  épreuves validées / sous le seuil.
- **Synthèse déterministe** : points forts et points faibles **relatifs à la promo**
  (z-score), écart à la médiane, nombre d'étudiants derrière soi. Une épreuve au-dessus
  de la promo n'est jamais présentée comme « à retravailler ».
- **Simulateur « et si »** : curseur par épreuve → moyenne, rang et centile recalculés
  à promo inchangée (l'ancienne moyenne de l'étudiant est retirée du classement avant
  d'y insérer la nouvelle, sinon il se classerait contre lui-même) ; et calcul inverse
  « quelle note me faut-il en X pour viser Y », avec signalement explicite d'un objectif
  hors d'atteinte.
- **Suggestions d'identifiant** (préfixe, sous-chaîne, distance d'édition bornée) au lieu
  d'un « introuvable » sec.
- **Suivi de progression local** (voir §Sécurité), **export CSV**, **tri des tableaux**,
  **feuilles multiples**.

### 5. Forme

En-tête supprimé de la page embarquée (l'écran natif titre déjà) ; barre d'outil
collante ; **résultats affichés dès l'import**, sans bouton « Générer » — les blocs
personnels apparaissent dès qu'un identifiant est résolu ; réglages repliés dans un
panneau ; tableau « épreuve par épreuve » en cartes sous 720 px ; barre et navigation
compactées sur mobile.

## Sécurité / conformité

- **Aucun changement au principe fondateur** : aucune note n'est envoyée, aucune table,
  aucune migration, aucune route API, aucun appel LLM. `RoleGate feature="partiel"` et
  la persona serveur restent la barrière d'accès.
- **Suivi de progression** : le stockage local (`medinfo:partiel:history`) ne contient
  **que les résultats dérivés de l'étudiant lui-même** — sa moyenne, son rang, son
  centile, ses propres notes — et des agrégats de promo (effectif). **Jamais les notes
  des autres étudiants**, qui sont des données de tiers. L'enregistrement est **explicite**
  (bouton + nommage de la session), et chaque entrée est supprimable. Un test vérifie que
  la sérialisation ne contient aucune note d'un tiers.
- **Aucun chiffre inventé** : une épreuve non notée n'est jamais comptée 0 (son
  coefficient sort du dénominateur) ; un centile sur promo vide renvoie « — » et non 0 ;
  une simulation impossible est annoncée comme telle. Les identifiants en double et les
  moyennes portant sur un nombre d'épreuves différent sont signalés à l'écran.

## Conséquences

- Les étudiants gardent le bénéfice principal (situer sa position) mais gagnent la
  raison d'y revenir : coefficients réels, simulation, progression.
- Le premier rendu ne télécharge plus **~1,9 Mo** de librairies ; un CSV n'en charge
  aucune.
- La page reste un fichier autonome : toute évolution du calcul doit passer par le bloc
  `@partiel-logic` et être couverte par les deux suites de tests.
- Vérification navigateur opt-in : `scripts/dev/partiel-smoke.mjs` (Chromium + Playwright,
  hors CI) rejoue le parcours réel sur les trois formats — CSV, .xlsx et PDF 2 pages
  générés à la volée. C'est lui qui a mis au jour la lecture « 7,5 » → 75.

## Rollback

Restaurer la version précédente de `public/partiel.html` (le reste de l'application n'a
pas de dépendance à son contenu), ou masquer l'onglet en retirant `partiel` de
`featureVisibility`. Les tests `partiel-engine.test.ts` et le helper deviendraient alors
caducs et seraient supprimés avec.

## Addendum 2026-07-25 — Base du classement général

La v3 se contentait de **signaler** que le classement mélangeait des étudiants notés sur un
nombre d'épreuves différent ; le filtre était laissé à l'arbitrage de Hugo, qui l'a tranché :
il faut pouvoir choisir les épreuves du classement total et ne comparer que le comparable.

`cohortMeans(students, subjects, weights, basis)` prend désormais une **base de classement** :

- `complete` (**défaut**) : seuls les étudiants notés sur **toutes** les épreuves incluses
  (coefficient > 0) entrent au classement. Les moyennes comparées portent alors toutes sur
  les mêmes épreuves.
- `partial` : comportement v3 (tout étudiant ayant au moins une note incluse), conservé pour
  les scolarités qui classent ainsi — et signalé à l'écran comme un mélange.

La base ne modifie **aucune note** : elle décide seulement qui est classé. Un étudiant hors
base garde sa moyenne, affichée avec « **hors classement** » et le nombre d'épreuves qui lui
manquent, **jamais un rang** — lui en donner un le comparerait à des moyennes qui ne portent
pas sur les mêmes épreuves. Le simulateur suit la même règle : il n'affiche un rang que si
les curseurs comblent toutes les épreuves manquantes.

Défaut corrigé au passage : pour un étudiant hors classement, `simulateOverall` retirait du
classement une moyenne « la sienne » qui n'y figurait pas — et pouvait donc retirer celle
d'un **autre** étudiant de valeur égale. L'ancienne moyenne n'est plus retirée que si
l'étudiant est effectivement classé.

Sélecteur dans Réglages (mémorisé localement), bascule directe depuis la carte de résultat,
et 7 tests unitaires + 10 contrôles navigateur dédiés.
