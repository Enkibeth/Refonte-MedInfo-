# ADR-0036 — Refonte du créateur de CV (v2 : sections libres, PDF vectoriel)

```yaml
status: Accepted
date: 2026-08-18
owner: Hugo Bettembourg
linked_to: [ADR-0028, ADR-0018, ADR-0019, ADR-0035, 03_SECURITY §RGPD, 05_DESIGN §6]
supersedes_note: "Fait évoluer le module d'ADR-0028 (éditeur structuré, aperçu A4, relecture IA, historique cloud). Les principes fondateurs — gratuit, illimité, sans watermark, traitement client, RLS own-row, minimisation avant l'IA — sont INCHANGÉS."
```

## Contexte

Le créateur de CV livré par l'ADR-0028 remplissait son contrat minimal (éditer, prévisualiser,
exporter, faire relire) mais trois défauts le rendaient inutilisable pour ce à quoi il sert
réellement : candidater à un poste hospitalier.

**1. Le PDF exporté était une image.** L'export passait par `html2canvas` + `jsPDF.addImage` :
chaque page était une photographie JPEG de l'aperçu. Un PDF sans texte est illisible pour les
logiciels de tri (ATS) des CHU et des groupes hospitaliers : le CV est écarté avant d'être lu
par un humain. C'est un échec silencieux — l'étudiant voit un PDF net et ne saura jamais
pourquoi il n'a pas eu de réponse. C'était aussi un fichier lourd (plusieurs centaines de ko
pour deux pages) et non sélectionnable, donc impossible à copier-coller dans un formulaire de
candidature.

**2. Les rubriques étaient codées en dur.** Le modèle imposait `experiences[]`, `education[]`,
`researchProjects[]`, `references[]`, `certificates[]`, `languages[]`, `interests[]`,
`personalProjects[]`. Un interne qui veut une rubrique « Communications affichées », « Mobilités
internationales » ou « Formation post-graduée prévue » ne pouvait pas : il fallait détourner une
rubrique existante, ou modifier le code. Un CV académique (publications, financements,
enseignement) était hors d'atteinte.

**3. Il n'y avait pas de mise en page.** Un seul thème, aucun réglage (couleur, corps de texte,
interligne, marges, bandeau), et surtout **aucune maîtrise de la pagination** : le découpage en
pages était celui d'un `overflow` CSS découpé en tranches d'image. Une entrée pouvait être
coupée en deux au milieu d'une ligne, un titre de rubrique rester seul en bas de page. Un CV qui
déborde de trois lignes sur une deuxième page ne pouvait pas être resserré autrement qu'en
supprimant du contenu.

## Décision

Refonte complète de l'outil, **dans le patron du dépôt** (page autonome
`public/cv-builder.html` embarquée en iframe, moteur pur extrait et testé hors navigateur comme
celui de `partiel.html`), autour d'un **moteur de mise en page explicite** :

1. **Document versionné à sections libres** (`schemaVersion: 2`) : un en-tête + une liste
   ordonnée de sections, chacune une liste ordonnée d'entrées, avec quatre présentations
   (entrées, texte, étiquettes, niveaux) et deux colonnes (principale, bandeau latéral).
   `migrate()` ouvre sans perte tout ancien document et **est le seul endroit du dépôt qui
   connaît l'ancien format** : le serveur ne migre rien.
2. **Un moteur de mise en page pur** qui produit des primitives de dessin positionnées au
   point PostScript près, consommées à l'identique par l'aperçu A4 et par le PDF. La mesure
   du texte utilise les métriques des polices PDF standard, **identiques à celles que jsPDF
   inscrit dans le fichier** (test : écart < 0,001 pt). L'aperçu ne peut donc pas mentir sur
   les coupures de ligne ni sur le nombre de pages.
3. **Export PDF vectoriel** via l'API texte de jsPDF. Texte réel, sélectionnable, extractible,
   ordre de lecture maîtrisé, métadonnées `Title`/`Author`, liens cliquables, ~25 ko pour deux
   pages. `html2canvas` disparaît de la page.
4. **Pagination explicite et testée** : entrée jamais coupée, titre jamais orphelin, saut de
   page forçable, entrée trop haute signalée plutôt que masquée, taux de remplissage par page,
   et un « Ajuster pour tenir en N pages » borné par des planchers de lisibilité **qui échoue
   honnêtement** au lieu de produire un CV illisible.
5. **Thème complet** (palette, couleurs libres, typographie, espacements, marges, bandeau,
   liseré, filets, puces, disposition d'en-tête) avec **contrôle de contraste WCAG AA** sur les
   couples réellement imprimés.
6. **Interface à trois volets** : arborescence des rubriques en glisser-déposer (réordonner,
   changer de colonne, déplacer une entrée d'une rubrique à l'autre), aperçu A4 éditable en
   ligne (double-clic sur un texte), inspecteur contextuel + onglet Thème. Sous 1024 px, édition
   et aperçu passent en onglets. Undo/redo 60 pas, bibliothèque locale multi-CV, import/export
   du document JSON, 3 modèles de départ.

## Ce qui NE change pas

- Gratuit, illimité, sans filigrane, sans mur d'inscription avant l'export : un visiteur non
  connecté crée, édite et télécharge son CV.
- Aucune API payante, aucun rendu serveur, aucune ressource externe : polices et librairies
  auto-hébergées, chargées à la demande (rien au premier rendu).
- Les données ne partent que sur action explicite : `/api/cv-docs` (RLS own-row, migration
  `0029`) et `/api/cv` (relecture). **La photo et les contacts ne sont jamais envoyés à l'IA.**
- Garde persona serveur (`resolveChatPersona` : étudiant/pro vérifié ou admin) et rate-limit
  sur les deux routes IA ; `RoleGate` reste une défense en profondeur, jamais l'unique barrière.
- Aucune nouvelle table, aucune migration, aucune nouvelle feature IA : `cv_review` et
  `cv_import` sont conservées telles quelles (le prompt de `cv_review` décrit désormais la
  structure v2 et le format des `fieldPath`).

## Conséquences

- **`sanitizeCvForAi` préserve les index.** Les suggestions de l'IA reviennent sous forme de
  chemin (`sections.2.entries.0.bullets.1`) appliqué directement au document côté client :
  filtrer une section ou une entrée vide décalerait tout et appliquerait une correction au
  mauvais champ. Un test verrouille ce point.
- **Le PDF est limité aux polices standard** (Helvetica, Times). Embarquer une police
  d'interface coûterait ~300 ko par graisse et interdirait la mesure exacte hors navigateur.
  Les caractères hors WinAnsi (grec, cyrillique, CJK) ne peuvent pas être écrits : ils sont
  remplacés par « ? » **et l'outil le signale** avant l'export.
- **La photo reste le seul élément non vectoriel** du fichier (recadrée et masquée côté client),
  sans effet sur l'extraction de texte.
- Les CV enregistrés avant la refonte (cloud ou brouillon local) s'ouvrent tels quels : ils sont
  migrés à la lecture, côté client, puis ré-enregistrés au format v2 à la première modification.

## Vérification

- `tests/unit/cv-engine.test.ts` (31 tests) : mesure et interlettrage, coupure de lignes,
  migration v1→v2 et idempotence, bornage du thème, pagination (entrée insécable, titre non
  orphelin, saut forcé, débordement signalé, colonnes indépendantes, ordre de lecture),
  ajustement (dont l'échec honnête), contraste des cinq palettes, nettoyage d'un collage Word,
  modèles sans donnée inventée.
- `tests/unit/cv-pdf.test.ts` (10 tests) : égalité des métriques moteur ↔ jsPDF, puis
  **relecture du PDF réellement produit** — vrai texte, nombre de pages identique à l'aperçu,
  accents et ligatures, ordre de lecture, aucun texte superposé, aucune page rastérisée,
  métadonnées, poids et temps de génération.
- `tests/unit/cv-document.test.ts` : bornage du payload et minimisation RGPD côté serveur.
- `scripts/dev/cv-smoke.mjs` (opt-in, hors CI) : parcours navigateur complet et vérification du
  fichier téléchargé.

## Suivi

- Le contenu du CV reste une **donnée personnelle** : toute évolution qui l'enverrait ailleurs
  (partage par lien, export vers un tiers, génération de lettre de motivation) demande un ADR.
- Documentation d'exploitation : `docs/CV_BUILDER.md` (architecture, ajout d'un thème ou d'un
  modèle, limites connues).
