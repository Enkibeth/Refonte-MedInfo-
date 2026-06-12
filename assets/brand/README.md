# Assets de marque MedInfo AI

Le logo affiché dans l'app est désormais une **image officielle** (et non plus du code) :
`assets/brand/logo-wordmark.png` — croix médicale + cervelet « circuit » + wordmark
« MedInfo AI » en bleu pétrole, **PNG détouré (fond transparent)**.

## Fichiers

| Fichier | Rôle | Format |
|---|---|---|
| `logo-wordmark.png` | Wordmark complet, rendu par `src/ui/Logo.tsx` | 1024×297, transparent (ratio h/L ≈ 0.29) |
| `legacy-illustration.png` | Illustration de marque (accueil), **transitoire** | 1200×1200 |
| `team-illustration.png` | Illustration de l'équipe (header public, pastille ronde dans `src/ui/LandingHeader.tsx`) | 512×512 |
| `../icon.png` | Icône d'app (symbole croix+cervelet, fond blanc) | 1024×1024 |
| `../favicon.png` | Favicon web | 256×256 |
| `../splash-icon.png` | Splash (symbole blanc, transparent → fond petrol) | 1024×1024 |

## Branchements

- **Logo** : `src/ui/Logo.tsx` rend `<Image source={require('../../assets/brand/logo-wordmark.png')} />`
  avec `resizeMode="contain"`. Tailles : `sm` 120 / `md` 170 / `lg` 220 (largeur), hauteur = largeur × 0.29.
  En `tone="light"` (hero, fond petrol foncé), le logo bleu est posé dans une pastille blanche arrondie
  pour le contraste — l'image n'est jamais recolorée.
  > ⚠️ L'alias `@/*` pointe vers `./src/*` : pour les assets (à la racine `./assets`), utiliser des
  > chemins relatifs (`../../assets/...` depuis `src/ui/`, `../assets/...` depuis `app/`).
- **Illustration** : `app/index.tsx`, sous le bloc « Finalité prévue ».
- **Icône / favicon / splash** : référencés dans `app.json` (`expo.icon`, `expo.web.favicon`,
  plugin `expo-splash-screen.image`, `backgroundColor` `#0A4D68`).

## Source & régénération

Les dérivés sont produits à partir de deux sources carrées 1254×1254 (logo wordmark + illustration)
par détourage du fond blanc (luminance → alpha) et recadrage du symbole pour l'icône.

> Note `05_DESIGN §6` : l'imagerie générée par IA est déconseillée pour l'identité **définitive** —
> `legacy-illustration.png` est gardée à titre **transitoire**, c'est volontaire.
