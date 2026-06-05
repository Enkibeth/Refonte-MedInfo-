# MedInfo AI — Design System

```yaml
title: Design System
version: 1.0.0
owner: Hugo Bettembourg
status: Active
date: 2026-06-02
linked_to: [02_ARCHITECTURE.md, 04_CHATBOT.md]
```

> Reprend l'identité existante (logo, palette petrol blue validée). Minimalisme assumé : une seule page d'entrée, login obligatoire, puis chat épuré routé par audience.

---

## 1. Principes directeurs

- **Minimalisme clinique.** Interface dépouillée, sobre, médicale. L'attention va au contenu, pas au chrome.
- **Cohérence cross-platform.** Mêmes tokens web/iOS/Android (NativeWind ou Tamagui).
- **Lisibilité avant tout.** Contraste WCAG AA minimum (texte médical = pas d'ambiguïté).
- **Confiance.** Le design signale rigueur et sérieux, jamais gadget.

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
| `background` | `#FAFBFC` | fond d'app (off-white, moins plat que blanc pur) |
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
`warningBackground`). Élévations discrètes via `tokens.elevation.{sm,md,lg}` (web).

**Phase 1 : monochrome petrol.** Accents par audience (public/étudiant/pro) **différés en Phase 2** — ne pas fragmenter l'identité au lancement.

---

## 3. Typographie

| Rôle | Police | Poids | Taille (base) |
|---|---|---|---|
| Titres | Inter / system-ui | 600-700 | 24-32 px |
| Corps | Inter / system-ui | 400 | 16 px |
| UI / labels | Inter / system-ui | 500 | 14 px |
| Mono (code, items EDN) | JetBrains Mono / monospace | 400 | 14 px |

Hiérarchie claire display>H1>H2>H3>corps via `tokens.type.*` (échelle modulaire ~1.2,
letter-spacing négatif sur les grands titres = rendu « dessiné »). Poids via
`tokens.weight.*` (400/500/600/700 — on évite le 800 omniprésent). Interligne corps 1.5.
**Inter** chargé sur web (`app/+html.tsx`, avec lissage anti-aliasing), police système
en natif ; mono JetBrains Mono (items EDN). Familles via `tokens.font.{sans,mono}`.

---

## 4. Composants clés

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

## 5. Layout

- **Page d'entrée unique** : logo, value prop courte, CTA login/signup. Rien d'autre.
- **Post-login** : routing audience (sélection au 1ᵉʳ login, modifiable en réglages) → chat plein écran épuré.
- **Chat** : header (nom bot + statut + bouton Sources) / fil scrollable / input bas / disclaimer permanent.
- **Réglages** : gestion compte, switch student→pro (si RPPS vérifié), suppression historique totale, dossiers, export PDF.
- Responsive parfait mobile/tablette/desktop (Expo = natif).

---

## 6. Iconographie & assets

- Logo existant repris tel quel. Décliné en favicon, app icon (iOS/Android), splash.
- Set d'icônes cohérent (lucide-react / phosphor — open, léger).
- Pas d'images DALL·E ; visuels sobres ou illustrations cohérentes si besoin.
- App icon : fond petrol + monogramme/logo, conforme guidelines Apple/Google.

---

## 7. Accessibilité (non négociable pour médical)

- Contraste WCAG AA min (AAA visé sur le corps de texte).
- Tailles de police ajustables (respect réglages système).
- Labels ARIA / accessibility props RN sur tous les contrôles.
- Navigation clavier complète (web).
- Pas d'information portée par la seule couleur (QCM : couleur + icône + texte).

---

## 8. Tokens — implémentation

Tokens centralisés dans `src/ui/tokens.ts` : `colors`, `font`, `weight`, `type` (échelle
typo), `space` (base 4), `radius` (8/12/16/20/pill — pas de « tout arrondi »), `elevation`.
Source unique : tout changement de couleur/typo/espacement passe par ce fichier, jamais de
valeur hex en dur dans les composants (vérifiable par lint custom si besoin).

Primitives UI partagées (consommatrices exclusives des tokens) :
- `src/ui/Button.tsx` — variantes `primary | secondary | ghost | danger`, tailles `md | lg`,
  états pressed/disabled/loading.
- `src/ui/Card.tsx` — surface surélevée (bordure fine + ombre légère, rayon mesuré).
- `src/ui/Screen.tsx` — conteneur d'écran (fond d'app, colonne centrée à largeur mesurée,
  alignée haut — on évite la carte « flottante au centre vertical » des templates).
