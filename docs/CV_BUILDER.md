# Créateur de CV — architecture et décisions

```yaml
status: Active
date: 2026-08-18
owner: Hugo Bettembourg
scope: public/cv-builder.html, src/cv/, app/api/cv*, app/(chat)/cv-builder.tsx
adr: ADR-0028 (module initial), ADR-0036 (refonte v2)
```

## Ce que l'outil garantit

1. **Le PDF exporté contient du vrai texte.** Il est produit par l'API texte de jsPDF
   (opérateurs `Tj`), pas par une capture d'écran. `pdftotext` en ressort un CV propre,
   dans l'ordre de lecture, sans doublon ni texte masqué. C'est la condition pour passer
   les logiciels de tri (ATS) des hôpitaux et des CHU.
2. **L'aperçu ne peut pas mentir.** Aperçu et PDF consomment les MÊMES primitives de
   dessin, calculées par le même moteur, avec les MÊMES métriques de police. Le nombre de
   pages affiché est le nombre de pages du fichier téléchargé.
3. **Coût marginal nul.** Aucune API payante, aucun rendu serveur. Tout le travail lourd
   (mise en page, pagination, PDF, photo) tourne dans le navigateur.
4. **Les données restent sur le poste.** Le contenu du CV et la photo ne partent que sur
   action explicite : « Enregistrer sur mon compte » (`/api/cv-docs`, RLS own-row) ou
   « Relecture IA » (`/api/cv`, CV minimisé : ni photo, ni contacts). Aucun traqueur,
   aucune requête vers un domaine tiers — polices et librairies sont auto-hébergées.
5. **Un visiteur non connecté fait tout** : créer, éditer, exporter. Aucun mur
   d'inscription avant le téléchargement.

## Où vit quoi

| Fichier | Rôle |
|---|---|
| `public/cv-builder.html` | L'outil entier : moteur pur + interface + export. Page autonome, sans build ni dépendance npm (convention du dépôt, cf. `partiel.html`, `article.html`, `presentation.html`). |
| ↳ bloc `@cv-engine:start/end` | **Moteur PUR** : modèle, migration, métriques, coupure de lignes, pagination, thèmes, contraste, ajustement, modèles, écriture du PDF. Zéro DOM, zéro réseau. |
| ↳ second `<script>` | Interface : arborescence + glisser-déposer, aperçu, édition en ligne, inspecteur, photo, bibliothèque, cloud, relecture IA, import. |
| `tests/unit/helpers/cvEngine.ts` | Extrait le bloc `@cv-engine` et l'exécute dans un `vm` Node : ce sont les fonctions RÉELLEMENT livrées qui sont testées. |
| `tests/unit/cv-engine.test.ts` | Mesure, coupure, migration, pagination, ajustement, contraste, collage, modèles. |
| `tests/unit/cv-pdf.test.ts` | Génère un vrai PDF avec le jsPDF servi par la page, puis **relit le fichier** : pages, ordre de lecture, doublons, accents, métadonnées, poids, vitesse. |
| `scripts/dev/cv-smoke.mjs` | Fumigation navigateur (opt-in, hors CI) : parcours complet + vérification du PDF téléchargé. |
| `scripts/dev/extract-pdf-font-metrics.cjs` | Régénère la table de largeurs de glyphes embarquée dans le moteur (7 familles × 4 styles). |
| `scripts/dev/build-cv-fonts.mjs` | Retélécharge et sous-ensemble les polices livrées (réseau + `pyftsubset`). |
| `tests/unit/helpers/pdfText.ts` | Extracteur de texte de PDF (WinAnsi **et** Identity-H + `/ToUnicode`) : la mesure de ce qu'un ATS lira. |
| `public/vendor/fonts/cv/` | Les cinq familles embarquables, sous-ensemblées, avec leurs licences OFL. |
| `src/cv/cvDocument.ts` | Côté serveur : validation/bornage du payload, minimisation RGPD avant l'IA, normalisation de l'import. |
| `app/api/cv-docs+api.ts` | CRUD cloud (client Supabase scopé au token → RLS own-row). |
| `app/api/cv+api.ts` | Relecture IA (`cv_review`). |
| `app/api/cv-import+api.ts` | Import d'un CV existant (`cv_import`). |
| `app/(chat)/cv-builder.tsx` | Écran natif : `RoleGate`, iframe, transmission du token par `postMessage`. |

## Le modèle de référence

L'apparence par défaut n'est pas une invention : elle reproduit **au point près** les deux CV
fournis par Hugo (le même modèle en deux couleurs). Les cotes ci-dessous ont été **relevées
dans les fichiers PDF eux-mêmes** — positions des aplats, tailles, couleurs et écarts de ligne
à ligne lus dans les flux de contenu — et non estimées à l'œil. Elles sont verrouillées par
`tests/unit/cv-engine.test.ts` (bloc « conformité au modèle de référence ») : si un CV exporté
cesse de ressembler au modèle, la CI le dit.

### Géométrie (A4 595,28 × 841,89 pt)

| Élément | Cote |
|---|---|
| Liseré accent | x 0 → 30 pt, pleine hauteur, **au bord de la page** |
| Bandeau latéral | x 30 → 208,584 pt, pleine hauteur (le liseré est découpé dedans) |
| Contenu du bandeau | x 40 → 198,584 pt (marge intérieure 10 pt) |
| Colonne principale | x 218,584 → 565,28 pt (gouttière 10 pt, marge droite 30 pt) |
| Marges haut / bas | 30 pt |
| Photo | 118,6 pt de côté, carrée, centrée dans le bandeau, haut à 30 pt |
| Filet sous les titres | 0,5 pt, `#d9d9d9`, 7,5 pt sous la ligne de base, largeur de la colonne |

### Typographie

| Rôle | Taille | Graisse | Couleur |
|---|---|---|---|
| Nom | 25 pt | gras | accent |
| Accroche | 8,8 pt | normal | texte |
| Titre de rubrique | 13,6 pt | **romain** | accent |
| Intitulé d'entrée | 8 pt | gras | `#333333` |
| Date | 8 pt | gras | accent, aligné à droite |
| Structure / lieu | 8 pt | romain | accent (colonne principale) · texte (bandeau) |
| Corps et puces | 8 pt | normal | texte |

### Rythme vertical (de ligne de base à ligne de base)

| Écart | Cote |
|---|---|
| Interligne | 8,8 pt (1,10) |
| Entre deux entrées | 18,8 pt |
| Titre de rubrique → première entrée | 29,6 pt |
| Dernière ligne → titre de rubrique suivant | 28,7 pt |
| Avant la première puce | 17,6 pt (une ligne sautée) |
| Entre deux contacts | 30 pt |
| Indentation des puces | 20 pt |

La police par défaut est **Helvetica** : les CV de référence sont composés en Liberation Sans,
dont les métriques sont celles d'Arial/Helvetica. Le rendu est donc identique au point près,
sans embarquer le moindre fichier de police. Les six autres familles restent disponibles dans
l'onglet Thème.

Deux palettes sont relevées telles quelles — **Rouge médical** (`#ad4040` / `#faf5f5`) et
**Bleu nuit** (`#0b1b7a` / `#f2f5f7`) — et quatre autres suivent la même construction : accent
soutenu, fond de bandeau très désaturé de la même famille, filet gris neutre, intitulés
`#333333`.

Tous ces réglages restent modifiables dans l'onglet Thème (couleurs par rôle, graisse des
titres, espacements fins) : le modèle est le point de départ, pas une prison. « Revenir au
modèle » remet toutes les valeurs d'origine en gardant la palette choisie.

## Modèle de document (v2)

Un CV est un JSON versionné. **Aucune rubrique n'est codée en dur** : c'est une liste
ordonnée de sections, chacune une liste ordonnée d'entrées. « Mobilités
internationales », « Communications affichées » ou « Formation post-graduée prévue »
s'inventent sans toucher au code.

```js
{
  schemaVersion: 2,
  meta:   { id, title, updatedAt },
  header: { fullName, headline, photo|null, contacts:[{id, icon, value, href}] },
  sections: [{
    id, title,
    column: 'main' | 'side',                       // colonne principale ou bandeau
    layout: 'entries' | 'tags' | 'ratings' | 'text' | 'list',
    pageBreakBefore,
    entries: [{ id, title, date, organisation, description:[], bullets:[], rating, underline }],
  }],
  theme: { … }                                     // couleurs, typographie, marges, bandeau
}
```

`migrate(raw)` ouvre **n'importe quoi** — ancien format à rubriques figées
(`experiences[]`, `education[]`…), v2, JSON importé, brouillon corrompu — et renvoie
toujours un v2 valide et borné. Elle est **idempotente** et **c'est le seul endroit du
dépôt qui connaît l'ancien format** : le serveur ne migre rien, il stocke le document tel
quel. Toute évolution du schéma passe par elle, avec ses tests.

## Le moteur de mise en page

```
document → blocs (unités insécables) → pagination par colonne → primitives positionnées
                                                                   ├→ aperçu DOM/SVG
                                                                   └→ PDF (jsPDF)
```

- **Mesure.** Les largeurs de glyphes des **sept familles** (quatre styles chacune) sont
  embarquées sous forme de table compacte, extraite de jsPDF lui-même — en unités de police,
  avec l'`upm` de la famille, pour reproduire son calcul au bit près. Un test verrouille
  l'égalité `measureText` ≡ `jsPDF.getTextWidth` à 0,001 pt près, famille par famille et
  style par style : c'est ce qui rend l'aperçu fidèle.
- **Bloc** = plus petite unité qui ne se coupe jamais (un titre de rubrique, une entrée,
  une ligne d'étiquettes). Ses primitives sont calculées en coordonnées relatives puis
  translatées : le même bloc sert à l'écran et au PDF.
- **Pagination.** Une entrée n'est jamais coupée en deux ; un titre de rubrique n'est jamais
  orphelin (il descend avec sa première entrée) ; `pageBreakBefore` force une page ; une
  entrée plus haute qu'une page entière est placée quand même et **signalée** (jamais
  masquée). Les deux colonnes s'écoulent indépendamment ; le nombre de pages est le maximum.
- **Ajustement.** « Tenir en N pages » descend une échelle déterministe de paliers :
  espaces, puis interligne, puis corps de texte et marges — bornée par des planchers de
  lisibilité (`FIT_FLOOR` : 3 pt entre blocs, interligne 1,08, corps 8 pt, marges 24 pt). Si aucun palier ne
  suffit, la fonction **échoue explicitement** et ne touche pas au thème.
- **Contraste.** Rapports WCAG 2.1 calculés sur les couples réellement imprimés (texte sur
  blanc, texte sur bandeau, accent sur bandeau…). Sous 4,5:1, un avertissement s'affiche
  au-dessus de l'aperçu et dans l'onglet Thème. Les cinq palettes livrées sont couvertes
  par un test.

## Ajouter ou régénérer une police

Les fichiers vivent dans `public/vendor/fonts/cv/` (un `.ttf` par style + la licence OFL de
chaque famille ; voir le README du dossier). Pour ajouter une famille :

1. L'ajouter à `FAMILIES` dans `scripts/dev/build-cv-fonts.mjs` (licence **SIL OFL
   obligatoire** — une police non libre ne peut pas être embarquée dans les PDF des
   utilisateurs), puis `node scripts/dev/build-cv-fonts.mjs` (réseau + `pip install
   fonttools brotli`).
2. `node scripts/dev/extract-pdf-font-metrics.cjs --write` pour régénérer la table de
   largeurs du moteur. **Sauter cette étape rend l'aperçu menteur** : il mesurerait avec les
   largeurs d'une autre police. Le script refuse d'écrire si le moteur et jsPDF divergent.
3. L'ajouter à `FONT_FAMILIES` dans le bloc `@cv-engine` (`key`, `label`, `kind`, `note`,
   `css`, `weightKo`). `weightKo` est le poids RÉEL ajouté au PDF par graisse — mesurable en
   exportant le même CV avec et sans la police.
4. Les tests couvrent automatiquement la nouvelle famille (mesure, extraction du texte,
   présence des fichiers et de la licence).

## Ajouter un thème

1. Ajouter une entrée à `THEME_PRESETS` dans le bloc `@cv-engine` :
   `{ key, label, accent, sidebarBackground, textColor, mutedColor }`.
2. C'est tout : la pastille apparaît dans l'onglet Thème, `defaultTheme(key)` construit le
   reste. Le test « valide les cinq palettes livrées » vérifiera automatiquement les
   contrastes de la nouvelle palette — **corriger la couleur, jamais le test**.

## Ajouter un modèle

1. Ajouter un cas dans `buildTemplate(key)` (sections, thème de départ) et une entrée dans
   `TEMPLATES` (`key`, `label`, `hint`).
2. Règle absolue : **aucun contenu inventé**. Les intitulés sont génériques
   (« Service — CHU de Ville », « 20XX »), `header.fullName` reste vide — un test le
   vérifie. Un modèle est un point de départ, pas un CV pré-écrit.

## Décisions prises (et pourquoi)

- **Page autonome plutôt que module React.** Le dépôt est une application Expo Router /
  React Native Web : `contenteditable`, glisser-déposer HTML5, `<canvas>` et rendu A4 au
  point près n'y sont pas praticables. Les quatre autres outils lourds du produit suivent
  déjà ce patron, avec le même contrat (iframe + `postMessage` du token + `RoleGate`).
  Conséquence assumée : pas de TypeScript ni de zustand/dnd-kit/zod dans la page — le
  moteur est en JS pur, mais entièrement testé hors navigateur.
- **Sept familles, dont cinq embarquées.** Les polices standard du PDF (Helvetica, Times)
  ne coûtent rien mais datent. Les cinq autres (Inter, Source Sans 3, Public Sans,
  EB Garamond, Lora — toutes SIL OFL) sont **sous-ensemblées au jeu WinAnsi** avant d'être
  livrées, ce qui les fait tomber de ~300 ko à 18-34 ko par graisse ; jsPDF les compresse
  encore à l'embarquement, soit **7 à 9 ko réellement ajoutés au PDF par graisse écrite**.
  Le prix est annoncé dans l'onglet Thème, mesuré et non deviné. Pour l'aperçu, c'est le
  MÊME fichier `.ttf` qui est servi en `@font-face` : l'écran ne peut pas montrer une police
  que le PDF n'aurait pas. Avec une police standard, l'aperçu utilise l'équivalent système
  (Arial/Liberation Sans, Times New Roman/Liberation Serif) et corrige la largeur de chaque
  ligne par un `scaleX` calculé sur les métriques du PDF.
- **Caractères hors WinAnsi.** Un alphabet non latin (grec, cyrillique, CJK) n'existe ni
  dans les polices standard, ni dans les sous-ensembles livrés : il serait écrit « ? ».
  L'outil le **dit** (avertissement listant les caractères concernés) au lieu de laisser
  découvrir le problème dans le fichier envoyé.
- **Le texte reste extractible avec une police embarquée.** jsPDF écrit alors les glyphes en
  Identity-H (des NUMÉROS de glyphe, pas des lettres) accompagnés d'une table `/ToUnicode`.
  C'est elle qui permet à un ATS de relire le CV : `tests/unit/helpers/pdfText.ts` la décode
  exactement comme le ferait `pdftotext`, et les tests échouent si un seul glyphe ne se
  retraduit pas.
- **Icônes de contact vectorielles**, dessinées en primitives (jamais une police d'icônes,
  jamais une image) : elles restent nettes et ne perturbent pas l'extraction de texte. Deux
  variantes sans icône (libellés « Tél. / Email… », ou valeur seule) sont proposées.
- **Ordre de lecture du PDF** : en-tête, colonne principale, bandeau latéral. C'est l'ordre
  attendu par un ATS (expériences et formation d'abord), même quand le bandeau est à gauche.
- **Sauvegarde cloud explicite.** Le CV est enregistré en continu dans le navigateur
  (`localStorage`, plusieurs CV nommés). Il ne part sur le compte que sur clic ; ensuite
  seulement, les modifications suivantes y sont répercutées automatiquement.
- **E2E Playwright** : le dépôt n'a pas de harnais E2E et n'en installe pas pour un outil.
  La garantie est portée par `tests/unit/cv-pdf.test.ts`, qui génère et **relit** un vrai
  PDF dans la CI, complété par `scripts/dev/cv-smoke.mjs` (navigateur réel, opt-in) qui
  vérifie en plus le téléchargement et l'absence d'erreur JavaScript.

## Limites connues

- Le rendu n'est fidèle que pour ce que le moteur sait dessiner : pas de colonnes multiples
  à l'intérieur d'une rubrique, pas de tableaux, pas de texte enrichi (gras/italique au
  milieu d'un paragraphe). Le soulignement d'un fragment est le seul enrichissement.
- La photo est une image (recadrée et masquée côté client) : c'est le seul élément non
  vectoriel du PDF. Elle n'affecte pas l'extraction de texte.
- L'import d'un CV existant dépend de la qualité de l'extraction PDF/Word et du modèle :
  il pré-remplit, il ne vérifie pas. L'utilisateur relit — c'est écrit dans l'écran d'import.
- `localStorage` a un quota (~5 Mo) : une photo lourde plus une dizaine de CV peuvent le
  saturer. L'échec est signalé, jamais silencieux.
