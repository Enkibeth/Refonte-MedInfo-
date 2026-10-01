# Reprise Claude Code — identité éditoriale plus vivante

Date : 2026-09-30. Branche de travail : `ai/codex/landing/editorial-life`.
Base de cette itération : `13beb994766d46a6fb0de80c8bee161c4b1cacc6`.

## Demande et périmètre

Hugo trouve le site « trop blanc et tout uniformisé », délègue les décisions
visuelles à Codex et réserve la vérification complète à Claude Code. Cette
branche contient également les photographies préparées lors de l’itération
précédente, qui n’avaient pas encore été publiées.

Direction retenue : accueil bleu brume, fond général ivoire, surfaces de lecture
blanches, espaces grand public/étudiant/pro en sauge/lilas/bleu et grande section
sources bleu nuit. Photos montées sur aplats lilas et sable ; repères d’outils
colorés ; FAQ plus éditoriale ; bordures d’accent au header/footer.

Les couleurs communes sont centralisées dans `src/ui/tokens.ts` et propagées aux
pages autonomes par `public/medinfo-tokens.css`. Pas de dépendance applicative,
d’effet React ni d’animation supplémentaire. Le comportement reduced-motion
existant est conservé. Revue React ciblée : constantes statiques hors du rendu,
composants et mappings existants réutilisés.

Aucun changement des prompts, API, contrôles d’accès, abonnements, données,
mentions réglementaires ou fonctions métier. Aucun merge ni déploiement.

## Contrôles effectivement réalisés sur cette itération

- `npm run typecheck` : réussi.
- `npm run build` : réussi, 28 routes statiques exportées.
- `npm exec -- vitest run tests/unit/design-tokens.test.ts tests/unit/hydration-hooks.test.ts tests/unit/feature-visibility.test.ts` : 29 tests réussis.
- Tests de tokens : parité de la feuille autonome, séparation fond/surface,
  trois teintes persona distinctes, contraste texte/fond >= 4,5:1 pour les
  nouveaux couples testés. Ce n’est pas un audit WCAG complet.
- `git diff --check` : propre.
- Captures du **fichier HTML public exporté**, JavaScript désactivé, à 390, 768,
  1024 et 1440 px : trois photographies décodées et aucun débordement horizontal
  détecté dans l’accueil. Rapport : `visual-check.json`.

Les 904 tests de la précédente itération ne sont pas présentés comme une
validation de cette branche. Suite complète, parcours interactifs, utilisateurs
connectés, natif, accessibilité complète et performance réelle restent à faire.

## Limites des aperçus — à lire avant de les utiliser

Les images `apercu-*.jpg` sont des **aperçus de composition**, pas des captures
d’une application opérationnelle ou d’un déploiement. Le script sert directement
`dist/server/index.html` et les assets de `dist/client`, uniquement en local.
Ce mode n’exécute ni JavaScript ni le routeur applicatif.

- Google Fonts n’est pas joignable depuis l’environnement de capture
  (`net::ERR_EMPTY_RESPONSE`) : polices de repli visibles. Le tableau
  `fontFaces: []` le confirme ; `FontFaceSet.check()` seul ne prouve pas qu’une
  police distante a été chargée.
- Le logo n’apparaît pas dans ces captures sans JavaScript. Contrôler son rendu
  dans le vrai parcours hydraté avant validation.
- Le build local n’a pas de configuration publique Supabase ; la tentative
  avec JavaScript signale l’absence de `EXPO_PUBLIC_SUPABASE_URL` ou de
  `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Aucun secret ni nouvelle configuration ajouté.

## Points de reprise prioritaires pour Claude

1. Reprendre dans un environnement normalement configuré. Ne pas déployer cette
   branche avant la recette et ne pas considérer les captures statiques comme
   une preuve de fonctionnement du routeur ou de l’authentification.
2. Contrôler la résolution de `/` sur le serveur exporté : lors du contrôle
   local sans JavaScript, le serveur applicatif renvoyait HTTP 200 avec
   « Accès réservé aux administrateurs. ← Retour ». Le fichier
   `dist/server/index.html` contient bien l’accueil public, tandis que
   `dist/server/(admin)/index.html` contient ce message. Une collision entre
   routes index est une **piste**, pas une cause confirmée. Aucune modification
   du serveur ni des gardes d’accès n’a été faite.
3. Reprendre l’erreur d’hydratation React #418 et le test de navigation
   précédemment non concluant. Ils ne sont pas annoncés résolus ici.
4. Vérifier accueil, menus, liens, accès par rôle et CTA à 390/768/1024/1440 px,
   avec les vraies polices et le logo ; vérifier chat/dashboard et pages
   autonomes touchés indirectement par les tokens partagés. Vérifier aussi
   focus clavier, contraste des états, zoom et reduced-motion.
5. Lancer la suite complète habituelle et la recette native si elle fait partie
   de la livraison. Décider ensuite du merge et du déploiement avec Hugo.

## Reproduire uniquement la composition

Après `npm run build`, avec Playwright et Chromium disponibles hors dépendances
applicatives :

```sh
MEDINFO_STATIC_VISUAL=1 node scripts/design/capture-editorial.mjs
```

Le script accepte `MEDINFO_PLAYWRIGHT_DIR`, `MEDINFO_CHROMIUM_EXECUTABLE` et
`MEDINFO_CHROMIUM_LIBDIR` pour les chemins locaux. Il écoute uniquement sur
`127.0.0.1:4174`, puis ferme le navigateur et le serveur. Le mode par défaut
(sans `MEDINFO_STATIC_VISUAL=1`) utilise le serveur applicatif réel ; le contrôle
statique n’est jamais une substitution à ce parcours.

Références : `docs/05_DESIGN.md`, ADR-0039 et ADR-0040.
Retour arrière : revert du changement de présentation ; aucune migration.
