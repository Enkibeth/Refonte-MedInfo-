# MedInfo AI — Design System

```yaml
title: Design System
version: 1.3.0
owner: Hugo Bettembourg
status: Active
date: 2026-07-06
linked_to: [02_ARCHITECTURE.md, 04_CHATBOT.md, audits/DESIGN_AUDIT_2026-06.md]
```

> Reprend l'identité existante (logo, palette petrol blue validée). Minimalisme assumé : une seule page d'entrée, login obligatoire, puis chat épuré routé par audience.

---

## 1. Principes directeurs

- **Minimalisme clinique.** Interface dépouillée, sobre, médicale. L'attention va au contenu, pas au chrome.
- **Cohérence cross-platform.** Mêmes tokens web/iOS/Android (NativeWind ou Tamagui).
- **Lisibilité avant tout.** Contraste WCAG AA minimum (texte médical = pas d'ambiguïté).
- **Confiance.** Le design signale rigueur et sérieux, jamais gadget.
- **Anti-générique.** Bannir les « tells » du design IA : kickers uppercase répétés, orbes
  de dégradés, grilles de cartes identiques, fade-in uniforme au montage, illustrations
  stock. Référence et checklist : `docs/audits/DESIGN_AUDIT_2026-06.md`.

---

## 2. Palette (refonte 2026-07 : bleu vif)

**Refonte 2026-07 (demande Hugo)** : le bleu pétrole (jugé fade) est remplacé par une
identité **bleu vif** — primaire électrique, hero/footer en bleu nuit profond, neutres
slate froids légèrement teintés bleu. Les clés de tokens sont inchangées (seules les
valeurs bougent) ; source unique : `src/ui/tokens.ts` (clés `tokens.colors.*`).

| Token (tokens.colors) | Hex | Usage |
|---|---|---|
| `accent` | `#2563EB` | accent principal, header, bulle user |
| `accentStrong` | `#3B82F6` | lueurs/décor (hero), états actifs clairs |
| `accentDeep` | `#1E40AF` | texte accent sur fond clair, profondeur |
| `accentDarker` | `#141E4E` | bleu nuit — fond hero/footer |
| `accentVivid` / `accentVividStrong` | `#0067FF` / `#0052D6` | CTA primaires et liens d'action (« bleu pétant ») + hover |
| `accentSurface` | `#EEF4FF` | fond teinté léger (encarts, badges) |
| `accentSurfaceStrong` | `#D9E6FF` | bordure des fonds teintés |
| `background` | `#F7F9FC` | fond d'app (off-white teinté bleu, moins plat que blanc pur) |
| `surface` | `#FFFFFF` | cartes/panneaux surélevés |
| `surfaceAlt` | `#F3F6FA` | bulles IA, zones secondaires |
| `surfaceSunken` | `#EAEEF5` | champs de saisie, fonds enfoncés |
| `text` | `#0E1626` | texte principal (ink) |
| `textSubtle` | `#36435A` | texte tertiaire renforcé |
| `textMuted` | `#5D6B80` | texte secondaire (ink-soft) |
| `border` / `borderStrong` | `#DDE3ED` / `#C3CDDB` | bordures, séparateurs |
| `success` | `#157F50` | validation QCM correcte |
| `danger` | `#C42233` | erreur, refus, urgence |
| `warningText` | `#9A6516` | texte vigilance |

Sémantiques fournies avec leur fond doux (`successBackground`, `dangerBackground`,
`warningBackground`). Élévations via `tokens.elevation.{sm,md,lg}` (web) : ombres en
**deux couches** (contact + diffusion) — jamais un seul grand halo flou « template ».

**Teintes de pastilles par outil** (refonte shell 2026-07) : `tokens.colors.tints.{blue,
green, amber, rose, violet, teal, slate}` — paires fond doux + encre foncée. Chaque outil
porte une teinte stable dans toute l'app (mapping : `src/ui/featureChips.ts`), pensée pour
que les outils visibles ensemble pour un même rôle restent distincts. Usage strict :
pastille d'icône / monogramme (cartes d'outils, panneau Outils, activité récente) — jamais
des aplats de section, et jamais l'unique porteur d'information (icône + libellé toujours
présents).

Déclinaisons hors tokens à maintenir alignées : `app/+html.tsx` (theme-color, fond,
sélection, scrollbar), `app.json` (splash `#141E4E`), exports PDF (`src/chat/exportChatPdf.ts`,
`src/audio/exportPdf.ts`), pages autonomes `public/partiel.html` / `presentation.html` /
`cv-builder.html` (variables CSS `--accent*`).

---

## 3. Typographie

| Rôle | Police | Token | Poids |
|---|---|---|---|
| Titres de page (hero, H1, têtes de section) | **Fraunces** (serif éditoriale) / Georgia | `tokens.font.serif` | 600 |
| Titres UI (cartes, panneaux, modales) | DM Sans / system-ui | `tokens.font.display` | 600-700 |
| Corps, labels | Inter / system-ui | `tokens.font.sans` | 400-600 |
| Mono (code, items EDN) | JetBrains Mono / monospace | `tokens.font.mono` | 400 |

**Fraunces est la signature typographique de la marque** (audit 2026-06) : elle évite le
combo Inter/sans générique omniprésent dans les UIs générées. Strictement réservée aux
titres de page — jamais en corps de texte ni sur les petits titres UI.

**Règle d'application (uniformisation 2026-06)** — vérifiée sur toutes les pages :
- **Titre de page / d'écran** (un par écran : hero, H1 des pages pleines, en-tête des
  pages outils Audio/Document/ECOS/Partiels, états « sélection/préparation/évaluation »
  d'ECOS, état vide du chat, pages légales) : `tokens.font.serif`, poids **600**
  (`semibold`), taille `h1` sur page pleine, `h2` en en-tête d'outil compact.
- **Titres UI** (cartes, sections, modales, panneaux, gates) : `tokens.font.display`,
  poids 600.
- **Corps, labels, méta** : `tokens.font.sans`. **Aucun titre en `font.sans`.**
- **Zéro `fontSize` numérique en dur** : tout passe par `tokens.type.*` (seule exception :
  la taille des pictogrammes emoji décoratifs). Crans ajoutés : `hero` (44, headline de la
  landing uniquement) et `micro` (11 — badges, méta, onglets ; plus petit cran autorisé).

**Tracking des libellés uppercase** : deux crans seulement via `tokens.tracking.*` —
`caps` (0.8, étiquettes UI : badges, labels de section/champ, méta) et `capsWide`
(1.2, eyebrows éditoriaux marketing/hero/pages pleines). Jamais de valeur ad hoc.

Hiérarchie claire hero>display>H1>H2>H3>corps>label>caption>micro via `tokens.type.*`
(échelle modulaire ~1.2, letter-spacing négatif sur les grands titres = rendu « dessiné »).
Poids via `tokens.weight.*` (400/500/600/700 — on évite le 800 omniprésent ; les titres
sont en 600, jamais en chaîne littérale `'800'`). Interligne corps 1.5.
Polices chargées sur web via `app/+html.tsx` (Google Fonts, lissage anti-aliasing),
polices système en natif. Auto-hébergement des polices noté en reste-à-faire (audit).

---

## 4. Mouvement & micro-interactions

Le mouvement a toujours une fonction (guider, signaler un état, raconter) — jamais de
décor. Tokens : `tokens.motion.*` ; CSS global (keyframes, scrollbar) : `app/+html.tsx`.

- **Durées** : fast 120 ms, base 200 ms, slow 320 ms. **Easing** : ease-out
  `cubic-bezier(0.16,1,0.3,1)` pour les entrées/transitions, standard `(0.4,0,0.2,1)`
  en interaction. **Jamais de bounce/spring** sur des éléments d'interface.
- **Propriétés animées** : `transform` et `opacity` uniquement (pas de layout thrashing).
- **`Reveal`** (`src/ui/Reveal.tsx`) : fade + remontée 8 px ; sur web, déclenché **au
  scroll** (IntersectionObserver sur une sentinelle View 1×1 — ⚠️ piège : la ref
  d'`Animated.View` n'expose PAS le nœud DOM sur react-native-web). Une seule fois par
  bloc ; bloc déjà visible = entrée immédiate. Stagger 70 ms (`revealStagger`).
- **Micro-interactions** : bouton appui scale 0.98, hover lift -1 px + ombre md ;
  cartes persona lift -3 px au survol ; transitions CSS 180 ms ease-out (`transitionWeb`).
- **`HeroBackdrop`** (`src/ui/HeroBackdrop.tsx` + `.web.tsx`) : grille millimétrée,
  source de lumière petrol unique, tracé ECG en battement lent (cycle 9 s, keyframes
  `medinfo-ecg-draw`) — motif métier, pas décor générique.
- **`Skeleton`** (`src/ui/Skeleton.tsx`) : chargements en pulse d'opacité sobre.
- **`prefers-reduced-motion` strict** : tout est coupé (hook `useReducedMotion` côté RN,
  media query côté CSS) — contenu affiché à l'état final, ECG statique.

---

## 5. Composants clés

| Composant | Spécif |
|---|---|
| Réponse assistant | **pleine largeur sans bulle bordée** (refonte fluidité 2026-07, motif ChatGPT/OpenEvidence) : le contenu est posé sur le fond d'app ; les blocs internes (sources, propositions) gardent leurs cartes. Actions discrètes Copier / Régénérer sous chaque réponse terminée |
| Bulle user | fond `accent`, texte blanc, alignée droite, radius `xl` + coin pincé `xs`, maxWidth 85 % |
| Composer chat | **carte unifiée** (refonte 2026-07) : zone de texte sans bordure + rangée d'actions (dictée à gauche, envoi/stop à droite) dans une carte radius `xl` focusable ; Entrée envoie sur desktop (Maj+Entrée = retour ligne) ; pendant la génération le bouton d'envoi devient un bouton **stop** (encre sombre) et la saisie reste possible |
| Fil de messages | colonne de lecture centrée max 800 px (comme les écrans outils) ; **auto-scroll** pendant le streaming tant que l'utilisateur est en bas, bouton flottant « revenir en bas » sinon |
| Bouton Sources | header chat, icône + badge compteur, toggle vue (cf 04_CHATBOT §9) |
| QCM interactif | propositions cliquables, feedback `--success`/`--danger`, justification sourcée |
| Disclaimer permanent | légende discrète sous le composer (`textMuted`, caption) — plus de bandeau bordé qui mange l'écran mobile |
| Typing indicator | pastille de statut (icône + libellé de phase + 3 points animés) |
| Toggle d'historique (outils) | pill `accentSurface` avec icône horloge + chevron pivotant — jamais de glyphe texte « ▸/▾ » |
| Segmented control | rangée pill sur `surfaceSunken`, segment actif `accent` texte blanc (switch de chatbot, modes Analyse/Traduction) |
| Enregistreur audio | bouton rond 88 px `accentVivid` (micro blanc), état enregistrement : badge rouge + minuteur mono + bouton stop rond `danger` |

---

## 6. Layout

- **Page d'entrée unique** : logo, value prop courte, CTA login/signup. Rien d'autre.
- **Shell applicatif** (refonte 2026-07, principe « dashboard » validé par Hugo) :
  sur **desktop web (≥ 1024 px, connecté)**, les écrans applicatifs (groupes chat/compte/
  billing/admin) vivent dans un shell persistant — sidebar bleu nuit (`accentDarker`) avec
  logo, carte utilisateur (initiales + rôle), sections « Mon espace » (Vue d'ensemble +
  outils du rôle via `visibleFeatures`) et « Compte », carte « Données protégées » en pied ;
  barre supérieure avec fil d'Ariane, pastille de disclosure IA et bouton Aide.
  Source : `src/ui/shell/AppShell.tsx` (transparent sur mobile/natif/visiteur/pages
  publiques — la tab bar mobile reste la navigation). Couche d'ergonomie uniquement :
  RoleGate + autorisation serveur inchangés. Uniformisation 2026-07 : sous le shell,
  les groupes Compte/Tarifs masquent leur en-tête natif de Stack (doublon du fil
  d'Ariane, conservé sur mobile pour le retour) et le panel admin passe en en-tête
  clair (titre serif, badge ADMIN teinté, onglets à icônes ligne — plus d'emojis) ;
  les pages autonomes `public/partiel.html` / `presentation.html` / `cv-builder.html`
  / `article.html` ont leurs variables CSS alignées sur ces tokens (§2).
- **Vue d'ensemble** (`app/(chat)/dashboard.tsx`) : accueil de l'espace connecté — hero
  bleu nuit (« Qu'est-ce qui compte aujourd'hui ? », salutation + semaine ISO, stat tiles,
  fond `HeroBackdrop` : grille millimétrée + tracé ECG animé, coupé sous reduced-motion),
  grille des outils du rôle à pastilles teintées, rail droit (Prochain objectif dérivé du
  plan de révision réel + Activité récente chat/ECOS/révisions). Chiffres exclusivement
  issus des données utilisateur et du moteur déterministe (`src/dashboard/overview.ts`,
  module pur testé) ; chaque source est fail-soft. Post-login → Vue d'ensemble ; sur
  mobile, onglet « Accueil » en tête de tab bar (slot réservé via `tabBarFeatures`).
- **Post-login** : routing audience (sélection au 1ᵉʳ login, modifiable en réglages) → Vue d'ensemble, chat plein écran épuré à un clic.
- **Chat** : header (nom bot + statut + bouton Sources) / fil scrollable / input bas / disclaimer permanent.
- **Réglages** : gestion compte, switch student→pro (si RPPS vérifié), suppression historique totale, dossiers, export PDF.
- Responsive parfait mobile/tablette/desktop (Expo = natif).

---

## 7. Iconographie & assets

- Logo existant repris tel quel. Décliné en favicon, app icon (iOS/Android), splash.
- Set d'icônes cohérent (chemins style Lucide dans `src/ui/iconPaths.ts`, rendus par
  `<Icon>` — `icons.web.tsx` sur web, `icons.tsx` en natif).
- **Plus aucun emoji dans l'UI** (2026-06) : états vides, gates d'accès et listes de
  préparation utilisent des icônes ligne dans une pastille `accentSurface` (56 px,
  icône 26 px `accentDeep`). Les emojis du registre `AI_FEATURES` (panel admin) restent
  une convention interne du registre, pas un élément d'UI publique.
- Pas d'images DALL·E ; visuels sobres ou illustrations cohérentes si besoin.
- App icon : fond petrol + monogramme/logo, conforme guidelines Apple/Google.

---

## 8. Accessibilité (non négociable pour médical)

- Contraste WCAG AA min (AAA visé sur le corps de texte).
- Tailles de police ajustables (respect réglages système).
- Labels ARIA / accessibility props RN sur tous les contrôles.
- Navigation clavier complète (web).
- Pas d'information portée par la seule couleur (QCM : couleur + icône + texte).

---

## 9. Tokens — implémentation

Tokens centralisés dans `src/ui/tokens.ts` : `colors`, `font` (`sans`/`display`/`serif`/
`mono`), `weight`, `type` (échelle typo), `space` (base 4), `radius` (8/12/16/20/pill —
pas de « tout arrondi »), `elevation` (ombres 2 couches), `motion`, `focus`.
Source unique : tout changement de couleur/typo/espacement passe par ce fichier, jamais de
valeur hex en dur dans les composants (vérifiable par lint custom si besoin).

Primitives UI partagées (consommatrices exclusives des tokens) :
- `src/ui/Button.tsx` — variantes `primary | secondary | ghost | danger | inverse |
  outlineLight`, tailles `md | lg`, états pressed (scale 0.98)/hover/disabled/loading.
- `src/ui/Card.tsx` — surface surélevée (bordure fine + ombre légère, rayon mesuré).
- `src/ui/Screen.tsx` — conteneur d'écran (fond d'app, colonne centrée à largeur mesurée,
  alignée haut — on évite la carte « flottante au centre vertical » des templates).
- `src/ui/Reveal.tsx` — entrée au scroll (sentinelle DOM, cf. §4).
- `src/ui/Skeleton.tsx` — squelette de chargement pulsé.
- `src/ui/HeroBackdrop.tsx` / `.web.tsx` — fond de hero (grille + ECG, cf. §4).
