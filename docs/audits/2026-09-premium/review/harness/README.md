# Banc de la revue finale — jamais déployer

Scripts hors application et hors build produit, ayant produit les preuves de
`../REVIEW.md`. Ils servent l’export web **inchangé** (`npm run build:web`) et ne
remplacent qu’une chose : la requête client `/api/chat`, par un flux SSE synthétique
non médical (`tests/unit/helpers/chatAnswerFixtures.ts`). Toutes les autres routes `/api`
répondent 503 ; Supabase est coupé dans le navigateur (503). Aucune session, aucun rôle
et aucune donnée ne sont simulés : les parcours connectés ne sont **pas** couverts.

## Prérequis (hors dépendances du produit)

- Node ≥ 22.6 (`--experimental-strip-types` pour relire les fixtures TypeScript).
- Playwright avec Chromium : `PLAYWRIGHT_MODULE=/chemin/vers/playwright/index.mjs`.
- axe-core 4.13.0 installé **dans ce dossier** (`npm i axe-core@4.13.0` ici, pas à la racine).
- Derrière un proxy TLS : `BENCH_PROXY=http://hôte:port` et `BENCH_SPKI=<empreinte SPKI
  base64 du CA du proxy>` (sinon les polices Google ne se chargent pas et les captures
  ne sont pas fidèles). Ne jamais désactiver la vérification TLS.

## Lancer

```sh
npm run build:web
node --experimental-strip-types docs/audits/2026-09-premium/review/harness/server.mjs "$PWD/dist/client" 4173
cd docs/audits/2026-09-premium/review/harness
node chat-bench.mjs ./out            # 15 scénarios du chat (envoi, double clic, arrêts, coupure, régénération, défilement, veille, mouvement réduit, zone de lecture agrandie)
node captures.mjs http://127.0.0.1:4173 ./out/captures   # 32 écrans × 390/768/1024/1440 + axe + débordement + hydratation
node axe-chat.mjs http://127.0.0.1:4173 ./out/axe-chat   # axe sur le chat après réponse (propositions, radios, sources)
node keyboard.mjs http://127.0.0.1:4173 ./out/kb         # tabulation, menus et modale : Entrée, Échap, retour du focus
node hydration-check.mjs http://127.0.0.1:4173            # erreurs React #418 par route, largeur, préférences
node metrics.mjs http://127.0.0.1:4173 ./out/metrics.json 3   # FCP/LCP/CLS labo, médiane de 3
node shift-sources.mjs http://127.0.0.1:4173 /chat 390    # éléments responsables d’un décalage
# Chat réel sur un aperçu Vercel (invité, 1 message par contexte) : URL de partage en argument,
# jamais écrite dans le dépôt.
node real-chat.mjs "<URL de partage de l’aperçu>" ./out/real
```

`server.mjs` sert aussi les pages pré-rendues de `dist/server` comme le serveur Expo
(chemins sans groupes, routes dynamiques) : servir la page 404 pour une route non copiée
dans `dist/client` produit une fausse erreur d’hydratation.

Mesures de laboratoire seulement : navigateur sans tête, serveur local, un seul poste.
Elles ne remplacent ni les p75 terrain (Speed Insights) ni un appareil réel.
