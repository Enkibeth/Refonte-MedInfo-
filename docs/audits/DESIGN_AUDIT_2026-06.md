# Audit design 2026-06 — anti « design IA » + animations professionnelles

```yaml
status: Applied
date: 2026-06-11
scope: Ensemble du site (web first) — tokens, composants partagés, landing, écrans
branch: claude/medinfo-design-audit-obfess
```

## Partie 1 — Recherche : les règles qui distinguent un site « fait main » d'un site IA

Synthèse des références 2025–2026 (sources en bas de page).

### Les « tells » du design généré par IA (à bannir)

| Tell | Pourquoi c'est un tell |
|---|---|
| Kickers uppercase en pastille répétés à chaque section | Scaffolding de template, le tell n°1 recensé |
| Orbes/glows dégradés flottants en fond de hero | Décor par défaut des générateurs (violet/cyan ou non) |
| Grilles de 3 cartes identiques répétées (icône en boîte au-dessus du titre) | « Distributional convergence » : le layout le plus probable du web |
| Inter/system font partout, sans display distinctif | Combo typographique le plus courant des UIs générées |
| Fade-in identique sur tout, au montage | Motion sans intention ; rien n'est lié au scroll ni au contenu |
| Illustration stock/génériques | Asset interchangeable, aucun lien avec le produit |
| Bordure épaisse colorée sur un côté de carte, radius ≥ 24 partout, cartes imbriquées | Sur-décoration template |
| Bounce/spring sur des éléments d'interface | Motion « démo », pas produit |

### Les règles d'un rendu professionnel

- **Typographie** : paire display distinctive + corps lisible ; hiérarchie ≥ 1.25 entre niveaux ; letter-spacing négatif sur les grands titres seulement.
- **Motion** : 200–500 ms, ease-out (quart/quint/expo), `transform`/`opacity` uniquement, jamais de bounce ; chaque animation a une fonction (guider, indiquer un état, raconter) ; `prefers-reduced-motion` strict.
- **Profondeur** : ombres en couches (contact + diffusion), pas un seul grand halo flou.
- **Layout** : varier les gabarits entre sections (panneau à rangées ≠ grille de cartes) ; espacement serré dans un groupe, généreux entre sections.
- **Détails artisanaux** : scrollbar stylée, focus ring soigné, sélection de texte teintée, micro-interactions d'appui sur les CTA.
- **Santé spécifiquement** : bleus/verts calmes, beaucoup de blanc, lisibilité stricte (corps ≥ 14 px, contraste AA), crédibilité par les sources affichées — la palette petrol existante est conforme.

## Partie 2 — Application sur MedInfo

Le socle (tokens.ts, palette petrol, neutres cliniques, échelle modulaire, reduced-motion) était déjà sain. L'audit a éliminé les tells restants et enrichi la couche motion.

### Fondations (effet site entier)

1. **Signature typographique** — `Fraunces` (serif éditoriale, Google Fonts) ajoutée comme `tokens.font.serif`, appliquée aux titres de niveau page : hero et sections de la landing, sign-in, reset-password, account, choose-role, pricing, legal, PlaceholderScreen. DM Sans reste sur les titres UI, Inter sur le corps (lisibilité médicale).
2. **Ombres en couches** — `tokens.elevation` sm/md/lg refaites en double couche contact + diffusion.
3. **Transitions** — `transitionWeb` passée en ease-out `cubic-bezier(0.16,1,0.3,1)` 180 ms (réponse rapide qui « se pose », sans bounce).
4. **CSS global (`app/+html.tsx`)** — scrollbar fine neutre, keyframes `medinfo-ecg-draw` (tracé ECG) et `medinfo-shimmer` (squelettes de chargement), tous neutralisés sous `prefers-reduced-motion`.

### Motion

5. **`Reveal` déclenché au scroll (web)** — IntersectionObserver : chaque bloc se révèle à l'entrée du viewport, une seule fois ; comportement au montage conservé en natif ; reduced-motion respecté. API inchangée.
6. **Bouton** — appui : scale 0.98 net (remplace l'opacité+translateY) ; hover lift conservé.
7. **Hero animé avec sens** — `HeroBackdrop` (`src/ui/HeroBackdrop.tsx` natif / `.web.tsx` web) : grille millimétrée estompée, une seule source de lumière petrol, tracé ECG qui se dessine une fois au chargement (motif métier, pas décor générique).

### Dé-sloppification de la landing (`app/index.tsx`)

- Orbes de glow → remplacés par `HeroBackdrop`.
- Pastille kicker du hero → petites capitales nues, occurrence unique ; kickers de section (« Pour qui ? », « Mes accès », « Mes outils ») supprimés au profit de vrais titres.
- Illustration PNG générique supprimée (règle : asset réel ou rien).
- Bloc confiance : 3 cartes identiques → un panneau unique à 3 rangées, icône à côté du texte, séparées par des filets.
- `PersonaCard` : pastille uppercase → point coloré + libellé en casse normale.

### Vérification

- `npm run typecheck` : OK.
- `npm run test:unit` : 20 fichiers / 149 tests OK.
- `npx expo export -p web` : OK (export production).

### Reste à faire (suggestions hors scope)

- Squelettes shimmer dans HistoryPanel / chargements de listes (classe `medinfo-shimmer` prête).
- Auto-héberger les polices (latence + RGPD Google Fonts).
- Panneau historique : transition d'ouverture (translate + fade).

## Sources

- [Impeccable — Slop: the catalogue of AI design tells](https://impeccable.style/slop/)
- [925 Studios — AI Slop Web Design: Complete Guide (2026)](https://www.925studios.co/blog/ai-slop-web-design-guide)
- [Shuffle — Why Do Most AI-Generated Websites Look the Same?](https://shuffle.dev/blog/2026/01/why-do-most-ai-generated-websites-look-the-same/)
- [Gian Gallegos — How to Actually Design with AI in 2026](https://www.giangallegos.com/how-to-actually-design-with-ai-in-2026-without-making-generic-garbage/)
- [Primotech — UI/UX Evolution 2026: Micro-Interactions & Motion](https://primotech.com/ui-ux-evolution-2026-why-micro-interactions-and-motion-matter-more-than-ever/)
- [WebPeak — CSS/JS Animation Trends 2026](https://webpeak.org/blog/css-js-animation-trends/)
- [Mighty Fine Design — Website Animation Best Practices (2026)](https://mightyfinedesign.co/website-animation-guide/)
- [Eleken — Healthcare UI Design 2026: Best Practices](https://www.eleken.co/blog-posts/user-interface-design-for-healthcare-applications)
- [Adchitects — Healthcare Web Design in 2026](https://adchitects.co/blog/web-design-for-healthcare-best-practices-and-guidelines)
