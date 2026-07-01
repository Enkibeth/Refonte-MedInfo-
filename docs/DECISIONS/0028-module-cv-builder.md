# ADR-0028 — Module CV Builder (étudiant + professionnel)

```yaml
status: Accepted
date: 2026-06-30
owner: Hugo Bettembourg
deciders: Hugo
supersedes: []
related: [ADR-0018, ADR-0019, ADR-0026]
```

## Contexte

Les étudiants en santé et les professionnels ont besoin de produire un CV médical /
hospitalo-universitaire propre (candidatures d'internat, postes hospitaliers, masters,
mobilités internationales). Une proposition externe (ChatGPT) suggérait un module React +
Next.js + `@react-pdf/renderer` + Zustand. Cette stack ne correspond pas au dépôt (Expo
Router + React Native + react-native-web, routes `+api.ts`) et la proposition ignorait les
conventions internes (cloisonnement persona, convention feature IA, RLS own-row, ADR).

On veut un module **gratuit** pour la création / édition / aperçu / export, avec une relecture
IA **optionnelle** qui propose des suggestions à valider (jamais de réécriture automatique),
et une confidentialité conforme au principe de minimisation (RGPD/CNIL) puisqu'un CV contient
des données personnelles (identité, parfois celles des référents).

## Décision

1. **Architecture = page autonome + iframe**, sur le modèle du générateur de présentations
   (le jumeau le plus proche : éditeur visuel + aperçu + export, web-first).
   - `public/cv-builder.html` : éditeur structuré par sections, aperçu A4 WYSIWYG, export PDF,
     panneau de relecture IA, autosave, panneau « Mes CV ». Palette/fontes alignées sur
     `public/presentation.html`.
   - `app/(chat)/cv-builder.tsx` : wrapper natif (header `ToolsMenu` + titre Fraunces, iframe,
     transmission du token par `postMessage`, fallback natif, `<RoleGate feature="cv-builder">`).

2. **Export PDF = `window.print()` + CSS `@page`** (impression vectorielle), pas
   `@react-pdf/renderer` ni `html2canvas`. Le preview EST le document imprimé via une feuille
   `@media print`. On obtient un PDF vectoriel, texte sélectionnable, multi-page natif, sans
   dépendance ajoutée ni double source de vérité.

3. **Relecture IA = feature `cv_review`** (route `/api/cv`), suivant la convention feature IA
   (registre `AI_FEATURES`, `FEATURE_DEFAULTS`, `promptStore`, seed migration). Sortie
   STRUCTURÉE via `generateObject` + schéma Zod (score, problèmes bloquants, suggestions avec
   `fieldPath`/`originalText`/`suggestedText`). L'utilisateur accepte/refuse chaque suggestion ;
   `applyCvSuggestion` vérifie que le champ n'a pas changé avant d'appliquer. Le prompt interdit
   d'inventer une expérience/diplôme/compétence et de modifier une date sans la signaler.
   Garde persona serveur (`resolveChatPersona`) : étudiant / professionnel / admin uniquement.

4. **Stockage cloud = table own-row `cv_documents`** (migration 0029), sur le modèle de
   `presentation_decks` (ADR-0026) : client Supabase scopé au token → RLS, route `/api/cv-docs`,
   module de validation pur `src/cv/cvDocument.ts`, test RLS `tests/rls/cv-documents.test.ts`.
   Autosave localStorage en filet hors-ligne.

5. **Minimisation RGPD** : `sanitizeCvForAi` retire la photo et, par défaut, les coordonnées
   (téléphone/email) des référents avant tout envoi à l'IA. Un texte de transparence est affiché
   près du bouton de relecture.

6. **Cloisonnement** : feature `cv-builder` ajoutée à `featureVisibility.ts`
   (`personas: ['student', 'professional']`), onglet `_layout.tsx`, `RoleGate`. Le grand public
   ne voit pas l'outil ; le masquage UI n'est jamais l'unique barrière (autorisation serveur).

7. **Un seul thème** (`medical`, 2 colonnes) en v1, schéma extensible pour ajouter des thèmes.

## Conséquences

- Création, édition, aperçu, export PDF : **gratuits**, 100 % client. La relecture IA est
  réservée aux comptes vérifiés et passe par le quota technique étudiant (`checkChatRateLimit`).
- Le CV est stocké dans le cloud (own-row RLS) : il suit l'utilisateur entre appareils.
- **Impression multi-page** : la bande latérale colorée (liseré marine + fond clair) est peinte
  à l'impression par un élément `position: fixed` que Chrome repeint sur CHAQUE page → elle
  remplit toute la hauteur de toutes les pages, y compris la dernière (fidèle au gabarit de
  référence, validé sur un CV réel de 4 pages). Les blocs portent `break-inside: avoid` pour ne
  pas couper une entrée. La photo est stockée en base64 dans le JSON (borne de taille) ; un bucket
  Storage dédié reste une amélioration future.
- Aucune donnée de santé : un CV est une donnée personnelle, pas un dossier patient.

## Addendum 2026-07 (retours de test réel)

- **Export PDF « distribuable »** : `window.print()` laissait Safari ajouter ses en-tête/pied de
  page (URL, n° de page), des marges et un rognage de la colonne de droite → non distribuable.
  Remplacé par une génération **côté client** (html2canvas + jsPDF, mêmes CDN que `partiel.html`) :
  aucun chrome navigateur, plein cadre A4 exact, jamais de rognage, bande latérale pleine hauteur
  sur chaque page (feuille étendue à un nombre entier de pages A4). Rendu ~288 dpi.
- **Import d'un CV existant** (feature `cv_import`, `/api/cv-import`, migration `0030`) : le client
  extrait le TEXTE du CV (PDF via pdf.js, Word via mammoth, ou texte collé) et l'IA le structure
  (`generateObject` + schéma Zod) dans le modèle de CV. Règle stricte : **n'invente rien**, ne
  reformule pas, laisse vide l'absent ; la photo n'est jamais importée. Normalisation pure et
  testée (`normalizeImportedCv`), garde persona serveur + rate-limit, comme les autres routes IA.
- **Prod** : les migrations `0029`/`0030` doivent être appliquées à la base de production Supabase
  (le pipeline ne les pousse pas automatiquement) — sinon l'enregistrement échoue (table absente).

## Suivi / améliorations futures

Plusieurs thèmes ; bucket Storage pour la photo ; import depuis image/scan (OCR vision) et
LinkedIn ; quota dédié ; export Word.
