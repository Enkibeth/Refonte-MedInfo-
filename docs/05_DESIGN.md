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

## 2. Palette (validée)

| Token | Hex | Usage |
|---|---|---|
| `--petrol` (primaire) | `#0A4D68` | accent principal, header, CTA |
| `--petrol-prime` (variante) | `#0C4A6E` | hover, états actifs |
| `--petrol-deep` | `#083B52` | texte sur fond clair, profondeur |
| `--surface` | `#FFFFFF` | fond principal |
| `--surface-alt` | `#F4F7FA` | fond messages IA, cartes |
| `--ink` | `#0F1B22` | texte principal |
| `--ink-soft` | `#4A5A63` | texte secondaire |
| `--border` | `#E1E8ED` | bordures, séparateurs |
| `--success` | `#1A9E60` | validation QCM correcte |
| `--danger` | `#D7263D` | erreur, refus, urgence |
| `--warning` | `#E8A33D` | vigilance |

**Phase 1 : monochrome petrol.** Accents par audience (public/étudiant/pro) **différés en Phase 2** — ne pas fragmenter l'identité au lancement.

---

## 3. Typographie

| Rôle | Police | Poids | Taille (base) |
|---|---|---|---|
| Titres | Inter / system-ui | 600-700 | 24-32 px |
| Corps | Inter / system-ui | 400 | 16 px |
| UI / labels | Inter / system-ui | 500 | 14 px |
| Mono (code, items EDN) | JetBrains Mono / monospace | 400 | 14 px |

Hiérarchie claire H1>H2>H3>corps. Interligne corps 1.5. Système d'abord (perf RN), Inter en fallback web.

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

Tokens centralisés dans `src/ui/tokens.ts`, consommés par NativeWind/Tamagui. Source unique : tout changement de couleur/typo passe par ce fichier, jamais de valeur hex en dur dans les composants (vérifiable par lint custom si besoin).
