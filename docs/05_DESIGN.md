# MedInfo AI — Design System

```yaml
title: Design System
version: 1.2.0
owner: Hugo Bettembourg
status: Active
date: 2026-06-13
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

## 2. Palette (validée, étoffée)

Identité petrol conservée, déclinée en rampe pour la profondeur et les fonds teintés ;
neutres cliniques (gris froids désaturés) pour éviter l'aspect « template plat ».
Source unique : `src/ui/tokens.ts` (clés `tokens.colors.*`).

| Token (tokens.colors) | Hex | Usage |
|---|---|---|
| `accent` | `#0A4D68` | accent principal, header, CTA, bulle user |
| `accentStrong` | `#0C5C7E` | hover, états actifs |
| `accentDeep` | `#083B52` | texte accent sur fond clair, profondeur |
| `accentSurface` | `#EFF5F9` | fond teinté léger (encarts, badges) |
| `accentSurfaceStrong` | `#DCEAF1` | bordure des fonds teintés |
| `background` | `#F7FAFB` | fond d'app (off-white teinté petrol, moins plat que blanc pur) |
| `surface` | `#FFFFFF` | cartes/panneaux surélevés |
| `surfaceAlt` | `#F4F6F8` | bulles IA, zones secondaires |
| `surfaceSunken` | `#ECEFF2` | champs de saisie, fonds enfoncés |
| `text` | `#0F1B22` | texte principal (ink) |
| `textSubtle` | `#3A474E` | texte tertiaire renforcé |
| `textMuted` | `#697880` | texte secondaire (ink-soft) |
| `border` / `borderStrong` | `#DEE3E8` / `#C4CCD2` | bordures, séparateurs |
| `success` | `#157F50` | validation QCM correcte |
| `danger` | `#C42233` | erreur, refus, urgence |
| `warningText` | `#9A6516` | texte vigilance |

Sémantiques fournies avec leur fond doux (`successBackground`, `dangerBackground`,
`warningBackground`). Élévations via `tokens.elevation.{sm,md,lg}` (web) : ombres en
**deux couches** (contact + diffusion) — jamais un seul grand halo flou « template ».

**Phase 1 : monochrome petrol.** Accents par audience (public/étudiant/pro) **différés en Phase 2** — ne pas fragmenter l'identité au lancement.

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
| Bulle IA | fond `--surface-alt`, radius 12px, padding 12-16px, rendu Markdown |
| Bulle user | fond `--petrol`, texte blanc, aligné droite, radius 12px |
| Input chat | bordure `--border`, focus `--petrol`, placeholder engageant, bouton envoi icône |
| Bouton Sources | header chat, icône + badge compteur, toggle vue (cf 04_CHATBOT §9) |
| QCM interactif | propositions cliquables, feedback `--success`/`--danger`, justification sourcée |
| Disclaimer permanent | bandeau discret mais visible, `--ink-soft`, présent sur toute vue chat |
| Typing indicator | animation sobre 3 points |

---

## 6. Layout

- **Page d'entrée unique** : logo, value prop courte, CTA login/signup. Rien d'autre.
- **Post-login** : routing audience (sélection au 1ᵉʳ login, modifiable en réglages) → chat plein écran épuré.
- **Chat** : header (nom bot + statut + bouton Sources) / fil scrollable / input bas / disclaimer permanent.
- **Réglages** : gestion compte, switch student→pro (si RPPS vérifié), suppression historique totale, dossiers, export PDF.
- Responsive parfait mobile/tablette/desktop (Expo = natif).

---

## 7. Iconographie & assets

- Logo existant repris tel quel. Décliné en favicon, app icon (iOS/Android), splash.
- Set d'icônes cohérent (lucide-react / phosphor — open, léger).
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
