# ADR-0043 — Écriture sans tics, visuel affiné, SEO actuel, outils mobiles en plein écran

- Date : 2026-10-04
- Statut : Accepted — demandes de Hugo (« côté visuel, couleur, typo : éviter les — qui font très IA ; la partie SEO, mettre au goût du jour » ; puis « aligner les outils sur le chat, enlever la barre du bas inutile »), décisions déléguées
- Portée : textes visibles, design system (tokens, typographie), navigation mobile de l'espace, métadonnées et rendu serveur du blog

## Contexte (mesuré, build de production local)

- **Écriture** : 376 tirets cadratins dans des chaînes, dont ~270 visibles (titres d'onglet « X — Y — MedInfo AI », scores,
  exports PDF, outils autonomes) ; tics de texte généré sur l'accueil (« Approfondir. Réviser. Comprendre. », « Une nouvelle
  façon d'apprendre », « donnez forme à ») ; tutoiement et vouvoiement mêlés sur une même surface ; aucune espace insécable
  (« ? » seul en début de ligne mesuré sur l'accueil et le contact) ; FAQ et Tarifs annonçant des « fonctions avancées » que
  les abonnements ne débloquent pas (`plans.ts` : messages illimités seulement).
- **Visuel** (audit chiffré) : champs à 15 px (zoom automatique de Safari iOS au focus, connexion comprise) ; vert de
  succès à 4,43:1 sur son fond (sous AA) ; premier affichage gris #F2F2F2 (thème de navigation par défaut) ; filet bleu
  vertical sur chaque titre de page (tic de gabarit, titre décalé de 19 px) ; titres de même rang de familles et graisses
  différentes ; FAQ à 96-98 caractères par ligne ; numéros décoratifs en monospace ; 8 cartes d'outils pleine largeur
  sur la Vue d'ensemble ; nuances Tailwind mortes ; code décoratif mort (halo, grain, 3 animations CSS injectées partout).
- **SEO** : carte de partage = logo carré en « summary » ; aucune directive `max-image-preview` ; titres > 60 caractères ;
  JSON-LD sans graphe (`@id`) ; **articles de blog servis par une coquille unique** : un aperçu de lien ou un robot sans
  JavaScript voyait le titre générique du blog pour chaque article, sans son texte ; **pages d'outils indexables** dont le
  HTML pré-rendu ne contenait qu'un indicateur de chargement (8 mots), puis une carte « réservé aux comptes » ; coquilles
  d'outils autonomes (`/cv-builder.html`…) indexables en doublon ; pré-rendu du dashboard sans titre ni `noindex`.
- **Mobile** (captures de Hugo) : un outil empilait bouton « Outils », titre, paragraphe et barre d'onglets du bas ; le CV
  n'avait plus qu'un « tout petit cadre », alors que le chat occupe tout l'écran.

## Décisions

1. **Écriture** : plus de tiret cadratin comme incise ou liaison dans un texte affiché (deux-points, virgule, point,
   parenthèses ; un « — » isolé reste permis comme valeur vide), séparateur de titre « | MedInfo AI ». Scores cliniques :
   ponctuation SEULE, vérifiée par un script (lettres et chiffres identiques avant/après). Tics réécrits sur des faits
   (aucune promesse ajoutée) ; vouvoiement sur les pages publiques et l'authentification ; mention « fonctions avancées »
   retirée. Typographie française automatisée (espaces insécables avant ; : ! ? et dans « », apostrophe ’) sur 718
   chaînes visibles, CSS et chaînes techniques exclues. Verrou : `tests/unit/copy-typography.test.ts`.
2. **Bandeau du chat professionnel** : « Synthèse documentaire : la décision clinique appartient au professionnel de
   santé » au lieu de « Outil d'aide à la décision », contraire à `INTENDED_PURPOSE` (« pas destiné à compléter ou influencer
   les décisions cliniques »). Textes canoniques (`disclosures.ts`) inchangés.
3. **Design system** : `type.input` 16 px (et règle CSS 16 px au doigt sur tous les champs, outils autonomes compris),
   `type.reading` 16/26 pour la lecture longue, `type.ui`, `layout.measure` 600 ; vert succès #12744A (5,1:1) ;
   `surfaceSunken` distinct de `surfaceAlt` ; nuances Tailwind et `type.hero` retirés ; thème de navigation ivoire ;
   `PageTitle` sans filet ; titres de même rang alignés ; `text-wrap-style` balance/pretty ; chiffres tabulaires des
   colonnes alignées ; `theme-color` blanc ; code décoratif mort supprimé.
4. **Navigation mobile** : **plus de barre d'onglets en bas**. Sous 1 024 px, chaque écran de l'espace porte la barre
   compacte du chat (☰ + icône + titre) ; ☰ ouvre la même feuille que le chat (outils du rôle, espace, compte, ressources).
   Briques partagées : `src/ui/MobileSheet.tsx`, `src/ui/AppMobileHeader.tsx` (`AppMobileHeader`, `ScreenNavBar`,
   `NavigationSheet`), `src/ui/ToolScreenHeader.tsx`. Sur le web, barre compacte et en-tête large sont rendus tous deux et le
   CSS choisit selon la largeur (pré-rendu sans fenêtre, aucun écart d'hydratation).
5. **SEO** :
   - carte de partage 1200 × 630 (`public/social-card.png`, générée par `scripts/design/social-card.mjs` avec les polices,
     la palette et la photo du site) en `summary_large_image` avec dimensions et texte alternatif ;
   - robots `index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1` ;
   - graphe JSON-LD (`#organization`, `#website`, éditeur et auteur référencés), BlogPosting complet (`dateModified`,
     `mainEntityOfPage`, image toujours présente), fondateur tel que nommé sur À propos ;
   - titres < 60 caractères suffixe compris, descriptions sans promesse invérifiable (« relus », « chaque semaine » retirés) ;
   - **blog pré-rendu côté serveur** (`server/lib/blog-prerender.mjs`, branché sur `server/lib/html.mjs`) : métadonnées
     de l'article dans la tête, texte de l'article dans un `<noscript>` HORS de `#root` (même contenu que la page, aucun
     risque d'hydratation), 404 + `noindex` pour un article inconnu, liste des articles en liens sur `/blog`. Lecture
     Supabase par la clé anon (RLS : publiés seulement), délai 1,2 s, cache 5 min (30 s pour un absent), disjoncteur 30 s
     après un échec, repli intégral sur la coquille d'origine ;
   - **présentation publique de chaque outil** pour les visiteurs (`src/seo/toolPages.ts`, faits du produit, testés ;
     `src/ui/ToolPreview.tsx`) rendue dès le pré-rendu : `RoleGate` rend présentation et indicateur, et un script de tête
     (`src/ui/sessionHint.ts`) marque `<html data-session-hint>` si ce navigateur avait une session, pour afficher
     l'indicateur plutôt que la présentation (aucun flash pour les comptes connectés) ;
   - `noindex` sur les coquilles d'outils autonomes et le pré-rendu du dashboard ; `lastmod` réel des articles.

## Options écartées

- **Mode sombre** : coût élevé (couleurs résolues au chargement dans plus de 700 styles, pré-rendu sans connaissance du thème,
  logo raster) pour un bénéfice non demandé ; `color-scheme: light` conservé. À reconsidérer après consolidation complète
  de la palette.
- **Retirer l'illustration d'équipe de l'en-tête** : choix de marque de Hugo (2026-06). Seul son texte alternatif trompeur
  (« L'équipe MedInfo AI ») est retiré (image décorative dans un lien déjà nommé). Recommandation transmise : l'image
  paraît générée par IA (animaux, icône vétérinaire) et coûte en crédibilité sur un site médical.
- **ECG animé en boucle** et **règles robots spécifiques aux robots d'IA** (recherche vs entraînement) : arbitrages de
  marque ou d'entreprise laissés à Hugo ; aucun changement.
- **Typographie appliquée aux réponses générées** (chat, articles du blog stockés) : non, ce sont des contenus produits par
  les modèles ; les prompts du blog interdisent déjà le tiret cadratin.

## Conséquences

- Tout nouveau texte affiché : pas de « — » de liaison (test), vouvoiement côté public, espaces insécables.
- Tout nouvel écran d'outil sous `(chat)` : `<ToolScreenHeader feature=…>` ; un écran qui a déjà son H1 : `<ScreenNavBar>`.
- Toute nouvelle page d'outil indexable : entrée dans `src/seo/toolPages.ts` (faits seulement).
- Le pré-rendu du blog dépend de `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY` à l'exécution ; sans eux il est
  inactif (coquille d'origine).

## Retour arrière

Revert de la PR (aucune migration, aucune donnée). Pré-rendu du blog seul : retirer l'option `enrich` dans `server/index.mjs`.
