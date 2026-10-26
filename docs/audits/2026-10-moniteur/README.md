# Refonte créative « Moniteur » — captures avant / après (ADR-0047)

Build web local (`EXPO_PUBLIC_SUPABASE_URL=https://mock.supabase.co … npm run build`), Chromium (Playwright),
session simulée par `scripts/design/capture-ui.mjs` (étudiant vérifié pour les écrans connectés). Pages entières
avec `CAPTURE_FULL=1` ; captures statiques prises sous `prefers-reduced-motion: reduce` (état final de chaque
animation). Les planches « mouvement » sont prises animations actives, en fenêtre 1440 × 900.

| Fichier | Contenu |
|---|---|
| `avant-accueil-1440.jpg` / `apres-accueil-1440.jpg` | Accueil, page entière, ordinateur (réduit à 960 px de large) |
| `avant-accueil-375.jpg` / `apres-accueil-375.jpg` | Accueil, page entière, téléphone |
| `apres-accueil-768.jpg`, `apres-accueil-1024.jpg` | Accueil, tablette et petit ordinateur |
| `avant-dashboard-*.jpg` / `apres-dashboard-*.jpg` | Vue d’ensemble (étudiant), premier écran |
| `avant-chat-invite-*.jpg` / `apres-chat-invite-*.jpg` | Chat visiteur, état vide |
| `mouvement-premier-ecran.jpg` | Premier écran à 0,7 s, 1,5 s, 3,2 s et 5,2 s : balayage de la photo, tracé du moniteur, cycle des trois lectures |
| `mouvement-defilement-narratif.jpg` | Écran collant du défilement narratif à deux positions |

Contrôles associés (résultats dans la PR) : zéro erreur console, aucun contrôle sans nom, aucune cible tactile
< 44 px sur 16 écrans × 2 largeurs ; aucun débordement horizontal de page de 320 à 1920 px ; ordre de
tabulation et anneau de focus ; parcours visiteur / compte public / étudiant ; mouvement réduit.
Non mesuré : Lighthouse, Core Web Vitals, Safari iOS réel.
