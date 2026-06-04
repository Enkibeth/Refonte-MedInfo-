# Assets de marque MedInfo AI

Le logo affiché dans l'app est, pour l'instant, **rendu en code** (`src/ui/Logo.tsx`) :
croix médicale + wordmark « MedInfo AI » en bleu pétrole. Aucun binaire requis → build robuste.

## Pour passer au vrai logo image (fourni)
1. Dépose le logo officiel ici : `assets/brand/logo-wordmark.png` (PNG transparent, ~1024px de large).
2. Dans `src/ui/Logo.tsx`, remplace le rendu code par l'image :
   ```tsx
   import { Image } from 'react-native';
   export function Logo({ size = 'md' }) {
     const w = size === 'lg' ? 220 : size === 'sm' ? 120 : 170;
     return <Image source={require('@/assets/brand/logo-wordmark.png')}
                   style={{ width: w, height: w * 0.32, resizeMode: 'contain' }}
                   accessibilityLabel="MedInfo AI" />;
   }
   ```
3. Icône d'app / favicon / splash : dépose `assets/icon.png` (1024×1024), `assets/favicon.png`
   (48×48+), `assets/splash-icon.png`, puis référence-les dans `app.json`
   (`expo.icon`, `expo.web.favicon`, plugin `expo-splash-screen.image`).

## Ancien logo / illustration de marque (temporaire)
Pour afficher l'ancienne illustration « pour le moment » sur l'accueil :
1. Dépose-la ici : `assets/brand/legacy-illustration.png`.
2. Dans `app/index.tsx`, ajoute sous le bloc finalité :
   ```tsx
   import { Image } from 'react-native';
   // ...
   <Image source={require('@/assets/brand/legacy-illustration.png')}
          style={{ width: '100%', height: 220, resizeMode: 'contain', marginTop: 16 }}
          accessibilityLabel="Illustration MedInfo" />
   ```
> Note `05_DESIGN §6` : l'imagerie générée par IA est déconseillée pour l'identité
> définitive — l'illustration est gardée à titre transitoire.

Dis-moi quand les fichiers sont déposés et je fais le branchement (2 min).
