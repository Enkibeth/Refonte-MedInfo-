# ADR-0042 — Fondations web : en-têtes de sécurité, CSP à empreintes, HTML compressé, repères d'accessibilité

- Date : 2026-10-03
- Statut : Accepted — demande de Hugo (« reprendre les bonnes pratiques actuelles pour un site ultra propre et les appliquer à MedInfo », décisions déléguées)
- Portée : serveur Node (Hostinger), coquille HTML, structure d'accessibilité de tous les écrans, outillage qualité

## Contexte (mesuré, build de production local, 2026-10-03)

- **Sécurité HTTP** : seuls `X-Content-Type-Options` et HSTS étaient posés. Aucune CSP, aucune
  protection contre l'encadrement par un site tiers (clickjacking), aucune politique de référent
  ni de permissions navigateur.
- **HTML** : coquilles Expo servies non compressées (85 Ko pour l'accueil) et sans `charset` dans
  `Content-Type` (la balise `<meta charset>` arrive après les balises SEO, hors des 1 024 premiers
  octets) ; page de débogage `/_sitemap` d'Expo publique ; adresse inconnue → écran « Unmatched
  Route » de développement, sans titre ; aucune `ErrorBoundary` (page blanche en cas de plantage).
- **Accessibilité (axe-core 4, WCAG 2.2 AA + bonnes pratiques, 25 écrans × 2 largeurs)** : aucun
  repère `main`/`nav`/`header`/`footer` (508 nœuds hors repère), pas de lien d'évitement, trois H1
  sur la vue d'ensemble et aucun sur ECOS, deux champs date sans nom, barre d'onglets mobile en
  `role="tab"` sans `tablist`. Contrastes déjà conformes.
- **Lighthouse mobile (accueil)** : performance 56, LCP simulé 7,0 s, TBT 690 ms ; Best Practices 96.

## Décisions

1. **En-têtes de sécurité sur toutes les réponses** (`server/lib/security.mjs`) :
   `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`,
   `Permissions-Policy` (micro et plein écran pour le site lui-même, caméra/géolocalisation/
   paiement/USB coupés), `Cross-Origin-Opener-Policy: same-origin-allow-popups`.
2. **CSP par empreintes** sur chaque document HTML : `script-src 'self'` + empreinte SHA-256 de
   chaque script inline du document, calculée par le serveur au premier service du fichier — ni
   `'unsafe-inline'` ni `'unsafe-eval'` pour les scripts. `connect-src` limité à Supabase, CrossRef
   et Europe PMC (seuls services appelés depuis le navigateur) ; `media-src` ouvert au Storage
   Supabase (réécoute audio) ; `frame-ancestors 'self'`, `object-src 'none'`, `base-uri 'self'`.
   Interrupteur d'exploitation `CSP=off|report-only` (redémarrage, sans redéploiement de code).
   Zod passe en mode sans compilation (il sondait `new Function`).
3. **Coquilles HTML servies par notre serveur** (`server/lib/html.mjs`) à partir du manifeste de
   routes d'Expo, dans le même ordre de résolution : Brotli/gzip calculés une fois (85 → 16 Ko),
   `charset=utf-8`, CSP, statut 404 sur la page introuvable. Repli intégral sur le moteur Expo
   dès que le manifeste utilise SSR, middleware, redirections/réécritures ou `loader`.
4. **Structure d'accessibilité** : `LandingHeader` = `banner` + `navigation`, `SiteFooter` =
   `contentinfo`, `<MainContent>` sur les pages publiques, `screenLayout` des navigateurs de
   l'espace connecté (un `<main>` par écran), barre latérale/onglets = `navigation`, lien
   « Aller au contenu principal », un seul H1 visible par écran, liens de navigation rendus en
   vrais `<a href>` avec navigation interne conservée (`src/ui/navLink.ts`).
5. **Page 404 de marque**, **écran d'erreur global**, `/_sitemap` retiré (`sitemap: false`),
   **manifeste web + icônes**, **`/.well-known/security.txt`** (RFC 9116), **`/llms.txt`**
   construit depuis les mêmes métadonnées que le SEO (aucune promesse propre).
6. **ESLint 10** limité aux règles des hooks React (`rules-of-hooks`, `exhaustive-deps`), en
   erreur et dans la CI : aucun style imposé, seulement des défauts qui cassent un écran.

## Option écartée : découpage du bundle par route (`asyncRoutes`)

Essayé et mesuré : −30 % de JavaScript sur l'accueil, TBT réduit, mais **écran vide d'environ
1 s à chaque première navigation interne** (accueil → chat, mobile émulé, CPU ×4, réseau lent)
pendant le téléchargement du code de la page cible, contre un affichage immédiat avec le bundle
unique. Pour une application où l'on passe d'un outil à l'autre en permanence, régression réelle :
**non retenu**. Le LCP réel (PerformanceObserver) était identique dans les deux cas (≈ 0,45 s) ;
la hausse du LCP rapportée par Lighthouse avec le découpage est un artefact de sa méthode.
À reconsidérer seulement avec un préchargement des routes probables et un état de chargement.

## Conséquences

- Tout nouveau service appelé **depuis le navigateur** doit être ajouté à `THIRD_PARTY_CONNECT`
  (`server/lib/security.mjs`) — sinon la requête est bloquée (visible dans la console).
- Un script inline ajouté à une page est couvert automatiquement (empreinte calculée au service) ;
  `eval`/`new Function` restent interdits.
- Tout nouvel écran public place son contenu dans `<MainContent>` ; un nouveau groupe de routes
  connecté passe `screenLayout={screenMainLayout}` à son navigateur.
- Vérification : `npm run smoke:node` (26 contrôles, dont en-têtes, CSP, compression, 404,
  fichiers `.well-known`), fumigations partiels/CV servies avec la CSP de production.

## Retour arrière

`CSP=off` dans hPanel puis redémarrage (CSP seule). Revert de la PR pour le reste (aucune
migration, aucune donnée).
