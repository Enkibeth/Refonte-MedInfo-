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
| `scripts/dev/extract-pdf-font-metrics.cjs` | Régénère la table de largeurs de glyphes embarquée dans le moteur. |
| `src/cv/cvDocument.ts` | Côté serveur : validation/bornage du payload, minimisation RGPD avant l'IA, normalisation de l'import. |
| `app/api/cv-docs+api.ts` | CRUD cloud (client Supabase scopé au token → RLS own-row). |
| `app/api/cv+api.ts` | Relecture IA (`cv_review`). |
| `app/api/cv-import+api.ts` | Import d'un CV existant (`cv_import`). |
| `app/(chat)/cv-builder.tsx` | Écran natif : `RoleGate`, iframe, transmission du token par `postMessage`. |

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
    layout: 'entries' | 'tags' | 'ratings' | 'text',
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

- **Mesure.** Les largeurs de glyphes des polices PDF standard (Helvetica et Times, quatre
  styles chacune) sont embarquées sous forme de table compacte, extraite de jsPDF lui-même.
  Un test verrouille l'égalité `measureText` ≡ `jsPDF.getTextWidth` à 0,001 pt près : c'est
  ce qui rend l'aperçu fidèle.
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
- **Polices PDF standard (Helvetica, Times) plutôt qu'Inter / EB Garamond.** Embarquer une
  police d'interface dans un PDF coûterait ~300 ko par graisse (jsPDF ne sous-ensemble pas)
  et interdirait la mesure exacte hors navigateur. Les polices standard donnent un PDF de
  ~25 ko, une extraction de texte parfaite partout, et sont le standard des CV hospitaliers
  français. L'aperçu utilise leurs équivalents écran (Arial/Liberation Sans, Times New
  Roman/Liberation Serif) et corrige la largeur de chaque ligne par un `scaleX` calculé
  pour coller exactement aux métriques du PDF.
- **Caractères hors WinAnsi.** Un alphabet non latin (grec, cyrillique, CJK) n'existe pas
  dans ces polices : il serait écrit « ? ». L'outil le **dit** (avertissement listant les
  caractères concernés) au lieu de laisser découvrir le problème dans le fichier envoyé.
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
