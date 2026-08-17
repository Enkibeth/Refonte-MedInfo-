# Déploiement Hostinger (Node.js) + Supabase

```yaml
title: Deployment Runbook
version: 2.0.0
owner: Hugo Bettembourg
status: Active
date: 2026-08-16
note: remplace le runbook Vercel (v1) — Vercel a été entièrement retiré du dépôt
```

## Objectif

Faire tourner MedInfo AI (Expo Router en sortie serveur) sur l'hébergement **Node.js de
Hostinger**, avec :

- le bundle web servi depuis `dist/client` ;
- **toutes** les routes `+api.ts` (chat, ECOS, Stripe, admin, cron…) servies par le même
  processus Node ;
- le projet Supabase dédié connecté par variables d'environnement ;
- aucune clé secrète dans le dépôt.

## 1. Architecture de déploiement

Un **processus Node unique** (`server/index.mjs`, adaptateur `expo-server/adapter/http`)
sert les fichiers statiques **et** exécute les routes API.

| Fichier | Rôle |
|---|---|
| `app.json` | `expo.web.output=server` → l'export produit `dist/client` + `dist/server`. Requis pour les routes API. |
| `server/index.mjs` | Le serveur : statiques (cache, Brotli/gzip, ETag/304), routes Expo, en-têtes de proxy, arrêt gracieux, journal d'accès. |
| `server.js` | Fichier d'entrée `.js` demandé par hPanel — délègue à `server/index.mjs`. |
| `server/lib/*.mjs` | Modules purs (politique de cache, `.env`, proxy) testés dans `tests/unit/hostinger-server.test.ts`. |
| `scripts/hostinger/precompress.mjs` | Compression Brotli/gzip au build (il n'y a pas de CDN devant). |
| `scripts/hostinger/weekly-blog-cron.sh` | Déclencheur du cron hebdo du blog. |
| `ecosystem.config.cjs` | Config PM2 — **uniquement** si tu passes un jour sur un VPS. |
| `app/api/health+api.ts` | Smoke-test non secret : `GET /api/health`. |

> ⚠️ **Ce n'est pas un site React statique.** Un déploiement en mode « site statique »
> (preset React, sortie `dist`) servirait les pages mais **aucune route API** : plus de chat,
> plus de connexion, plus de paiement. Il faut impérativement le mode **application serveur**
> avec un fichier d'entrée.

## 2. Réglages du déploiement git dans hPanel

Dans **hPanel → Site web → Node.js → Déployer depuis GitHub** :

| Champ | Valeur |
|---|---|
| **Préréglage de framework** | **Other** (surtout PAS « React » : cela déploierait un site statique sans processus Node) |
| **Branche** | `main` (fusionner la branche de migration avant, cf. §7) |
| **Version de Node** | **22.x** |
| **Répertoire root** | `/` |
| **Commande de build** | `npm run build` |
| **Répertoire de sortie** | laisser vide (c'est le serveur qui sert `dist/`, pas l'hébergeur) |
| **Fichier d'entrée** | `server.js` |
| **Variables d'environnement** | tout le §3 — sans elles, le build produit un site inutilisable |

Après le premier déploiement, la carte de l'application affiche un badge **Running** avec un
bouton **Restart**, et des **Runtime Logs** (sortie de `console.log`) séparés des logs de
build. Si le badge n'apparaît pas, c'est que l'app a été déployée en statique : reprendre le
preset.

**Redéploiement automatique** : chaque `git push` sur la branche configurée relance
build + démarrage.

## 3. Variables d'environnement

### Règle à retenir

Les variables `EXPO_PUBLIC_*` sont lues **à deux moments différents** (vérifié sur le build
de ce dépôt) :

- **bundle client** : la valeur est **inlinée au build** — la changer après coup n'a aucun
  effet tant qu'on ne rebâtit pas ;
- **routes API** (`dist/server`) : `process.env.EXPO_PUBLIC_*` est lu **à l'exécution**.

👉 hPanel injecte les mêmes variables au build et au runtime : il suffit donc de **toutes**
les déclarer dans le panneau. Après modification d'une variable, **redéployer** (un simple
redémarrage ne suffit pas pour les `EXPO_PUBLIC_*`).

### Indispensables au fonctionnement

| Variable | Valeur | Secret |
|---|---|---:|
| `EXPO_PUBLIC_SUPABASE_URL` | URL du projet Supabase MedInfo | non |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | clé `anon` (protégée par RLS) | non |
| `SUPABASE_URL` | même URL que ci-dessus | non |
| `SUPABASE_SERVICE_ROLE_KEY` | clé `service_role` | **oui** |
| `AI_PROVIDER` | `anthropic` ou `openai` | non |
| `ANTHROPIC_API_KEY` | clé Anthropic | **oui** |
| `OPENAI_API_KEY` | clé OpenAI (modèle par défaut du chat = `gpt-5.2`) | **oui** |
| `GOOGLE_GENERATIVE_AI_API_KEY` | titres/catégories d'historique (`chat_meta`) | **oui** |
| `EXPO_PUBLIC_APP_URL` | `https://<ton-domaine>` — URL de retour Stripe, canonicals SEO, sitemap | non |
| `EXPO_PUBLIC_AUTH_REDIRECT_URL` | même domaine — e-mails de confirmation Supabase | non |
| `PORT` | le port déclaré dans hPanel (défaut applicatif : `3000`) | non |
| `NODE_ENV` | `production` | non |

### Facturation, vérification pro, cron

| Variable | Rôle | Secret |
|---|---|---:|
| `STRIPE_SECRET_KEY` | création des sessions Checkout | **oui** |
| `STRIPE_WEBHOOK_SECRET` | vérification de signature du webhook (seule source de vérité) | **oui** |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | clé publique | non |
| `STRIPE_PRICE_PUBLIC_MID` / `STRIPE_PRICE_STUDENT_MID` / `STRIPE_PRICE_STUDENT_PREMIUM` | `price_…` des plans (06_BILLING §1) | non |
| `ANNUAIRE_SANTE_API_KEY` | vérification RPPS (sans clé : statut pro `pending`) | **oui** |
| `CRON_SECRET` | agent éditorial hebdo (`openssl rand -hex 32`) | **oui** |

> Tant que les variables Stripe sont absentes, les routes de facturation renvoient `503`
> (« non configuré ») — désactivation propre, rien ne casse.

### Réglages serveur optionnels

| Variable | Défaut | Quand y toucher |
|---|---|---|
| `HOST` | `0.0.0.0` | jamais chez Hostinger |
| `TRUST_PROXY` | activé | `false` seulement si Node est exposé sans proxy devant |
| `ACCESS_LOG` | activé | `off` pour taire le journal d'accès |
| `EXPO_DIST_DIR` | `dist` | si le build est déposé ailleurs |

Le serveur lit aussi un fichier `.env` à la racine (`.env.production.local`, `.env.local`,
`.env.production`, `.env`), mais **les variables du panneau gagnent toujours** : un `.env`
oublié ne peut pas écraser une clé de hPanel.

## 4. Ce que fait `npm run build`

```bash
npm run build   # expo export -p web  +  pré-compression Brotli/gzip
```

- `dist/client/` — bundle web, assets, pages autonomes (`partiel.html`, `cv-builder.html`,
  `presentation.html`, `article.html`) et leurs variantes `.br`/`.gz` ;
- `dist/server/` — coquilles HTML pré-rendues + **routes API bundlées et autonomes** (elles
  n'appellent aucun paquet de `node_modules` à l'exécution ; seul `expo-server` est requis).

Le build est un build Metro : compter plusieurs minutes et ~2 Go de RAM. S'il échoue pour
mémoire insuffisante sur l'offre choisie, la solution de repli est de bâtir en local puis
d'envoyer `dist/` (voir §8).

## 5. Streaming — le point qui casse le chat s'il est mal réglé

Le chat répond **en streaming** sur des requêtes qui peuvent durer plusieurs minutes.
Le serveur Node est réglé pour ça (aucun tampon, aucun délai d'inactivité de socket,
`keepAliveTimeout` 75 s). Ce qui reste hors de notre contrôle, c'est le **proxy de
l'hébergeur** : s'il met en tampon ou coupe à 60 s, le symptôme est « la réponse ne
s'affiche pas » ou « réponse interrompue ».

À tester en recette (§6, point 3). Si le streaming n'arrive qu'à la fin, c'est le proxy :
ouvrir un ticket Hostinger en demandant la désactivation du buffering et un
`proxy_read_timeout` d'au moins 600 s pour l'application Node — ou basculer sur un VPS où la
conf nginx est à toi :

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host              $host;
    proxy_set_header X-Forwarded-Proto $scheme;   # sinon Stripe reçoit des URL http://
    proxy_set_header X-Forwarded-Host  $host;
    proxy_buffering off;          # sinon la réponse n'arrive qu'à la toute fin
    proxy_request_buffering off;
    proxy_read_timeout 600s;
    proxy_send_timeout 600s;
    client_max_body_size 16m;     # pièce jointe 6 Mo ⇒ ~8 Mo en base64
}
```

Durcissement optionnel côté proxy : `Strict-Transport-Security`,
`Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`
(⚠️ ne pas interdire l'iframe de même origine : les outils Partiels / CV / Présentation /
Article sont des pages autonomes embarquées en iframe).

## 6. Recette après déploiement

1. `GET https://<domaine>/api/health` → `ok: true`, `deployTarget: "hostinger"`,
   `supabase.configured: true`, `supabase.hostname` = projet MedInfo, provider IA attendu.
   *(`deployTarget` absent = c'est encore un ancien déploiement qui répond.)*
2. Accueil, `/chat`, `/pricing`, `/mentions-legales` → l'hébergeur affiché doit être
   **Hostinger**.
3. **Chat** : poser une question et vérifier que le texte arrive **au fil de l'eau**
   (sinon → §5).
4. Quitter l'onglet en pleine réponse, revenir : la réponse doit être retrouvée dans
   l'historique (archivage serveur).
5. Outils : `/partiel`, `/cv-builder`, `/presentation`, `/article` (pages autonomes).
6. **Supabase Auth** → *Authentication → URL Configuration* : mettre le nouveau domaine en
   **Site URL** et l'ajouter aux **Redirect URLs**, sinon les e-mails de confirmation
   pointent vers l'ancien domaine.
7. **Stripe** → Webhooks : endpoint sur `https://<domaine>/api/stripe/webhook`, événements
   `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted` ; reporter le `whsec_…` dans `STRIPE_WEBHOOK_SECRET`,
   puis « Send test webhook » → 200. Lancer un abonnement en mode test : l'URL de retour
   doit être en `https://`.
8. **Cron hebdo du blog** : hPanel → *Cron Jobs* → lundi 06:00, commande
   `/home/<user>/<app>/scripts/hostinger/weekly-blog-cron.sh`
   (ou `curl -fsS -m 900 -H "Authorization: Bearer <CRON_SECRET>" https://<domaine>/api/cron/weekly-blog`).
   Lancer une fois à la main : un article doit apparaître **en brouillon** dans le panel admin.
9. Vérifier les **Runtime Logs** hPanel : les lignes `[medinfo] GET /… 200 12ms` confirment
   que le serveur reçoit bien le trafic.

Vérification technique du serveur (statiques, cache, compression, 304, traversée de
répertoire, en-têtes de proxy), sur une machine disposant d'un build :

```bash
npm run build && npm run smoke:node   # 14 vérifications
```

## 7. Mise en service et mises à jour

Premier déploiement :

1. fusionner la branche de migration dans `main` ;
2. renseigner toutes les variables du §3 dans hPanel ;
3. lancer le déploiement ; surveiller les logs de build puis les Runtime Logs ;
4. dérouler la recette du §6.

Ensuite, chaque `git push` sur `main` rebâtit et redéploie. Les coquilles HTML sont servies
en `no-store` et les bundles portent un nom haché : aucun client ne reste bloqué sur
l'ancienne version.

## 8. Repli : build local + envoi de `dist/`

Si le build échoue sur l'hébergeur (mémoire), bâtir en local avec **les mêmes variables**
puis envoyer :

```txt
dist/client/**   (~12 Mo)   dist/server/**  (~30 Mo sans les .map)
server/**  server.js  package.json  package-lock.json  scripts/hostinger/**
```

puis `npm ci --omit=dev` sur le serveur. Les `dist/server/**/*.map` ne servent qu'au
débogage : `find dist/server -name '*.map' -delete` avant l'envoi si la place est comptée.

## 9. Notes Supabase (inchangées)

- `supabase/migrations/` reste la source versionnée du schéma.
- `profiles` est lu côté client avec la clé `anon` et la RLS.
- `ai_interactions` est écrit côté serveur avec `service_role` et ne doit jamais être
  accessible au client.
- Définir `SUPABASE_URL` **et** `EXPO_PUBLIC_SUPABASE_URL` (le serveur accepte le repli sur
  la seconde, mais l'ambiguïté n'aide personne).

## 10. Limites connues

- **Un seul processus** : les caches de configuration des features IA (60 s) sont par
  processus. Le rate-limit, lui, s'appuie sur Supabase (`usage_counters`) et reste correct en
  multi-instances — son repli mémoire ne sert que si `SUPABASE_SERVICE_ROLE_KEY` est absent,
  auquel cas un cluster ouvrirait un trou.
- **Pas de CDN** : la pré-compression et les en-têtes de cache immuables compensent
  l'essentiel. Un CDN (Cloudflare) peut être ajouté devant le domaine sans toucher au code —
  vérifier alors que `X-Forwarded-Proto` est transmis.
- **Sauvegardes** : le serveur ne contient aucune donnée utilisateur (tout est dans
  Supabase). La sauvegarde à surveiller reste celle de Supabase.

## 11. Mobile natif

Le chat mobile utilise aussi `/api/chat`. Avant une build native de production, définir
l'origine serveur (le domaine Hostinger) selon la stratégie Expo Router retenue et la
documenter dans une ADR.
