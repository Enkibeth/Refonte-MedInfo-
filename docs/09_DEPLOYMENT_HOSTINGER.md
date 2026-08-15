# Déploiement Hostinger (serveur Node.js autonome)

```yaml
title: Hostinger Node Runbook
version: 1.0.0
owner: Hugo Bettembourg
status: Active
date: 2026-08-15
remplace: docs/09_DEPLOYMENT.md (Vercel) — conservé comme chemin de repli
```

## Ce qui change par rapport à Vercel

Vercel faisait **trois** choses que le projet ne faisait pas lui-même : servir `dist/client`
via son CDN, exécuter les routes API dans une fonction, et déclencher le cron hebdomadaire.
En auto-hébergement, un unique processus Node (`server/index.mjs`) reprend les deux
premières ; le cron système reprend la troisième.

| Sujet | Vercel | Hostinger (Node) |
|---|---|---|
| Fichiers statiques | CDN + en-têtes de `vercel.json` | `server/lib/serve-static.mjs` (mêmes en-têtes, + Brotli/gzip pré-compressés) |
| Routes `+api.ts` | `api/index.js` → `expo-server/adapter/vercel` | `server/index.mjs` → `expo-server/adapter/http` |
| Durée maximale d'une réponse | `maxDuration: 300` | aucune limite Node — la vraie limite est le **timeout du reverse proxy** (à régler, voir §5) |
| Réponse qui continue après déconnexion du client | `waitUntil` (via `keepAlive()`) | inutile : le processus reste vivant, `consumeStream()` + `onFinish` suffisent (`keepAlive()` devient un no-op) |
| Cron blog hebdo | `vercel.json` → `crons` | cron système → `scripts/hostinger/weekly-blog-cron.sh` (§7) |
| Compression | CDN | `npm run precompress` au build (§3) |
| Analytics / Speed Insights | actifs | désactivés automatiquement (`EXPO_PUBLIC_DEPLOY_TARGET=hostinger`) |
| Mentions légales (hébergeur) | « Vercel Inc. » | « Hostinger International Ltd. » — piloté par la même variable (§4) |
| Journaux | dashboard Vercel | `pm2 logs medinfo-ai` (ou journalctl) |

> **Repli** : `vercel.json` et `api/index.js` restent dans le dépôt et fonctionnels. Un
> retour sur Vercel ne demande aucune modification de code, seulement de rebâtir avec
> `EXPO_PUBLIC_DEPLOY_TARGET=vercel` (ou variable absente).

## 1. Choix de l'offre Hostinger

Le serveur doit exécuter un **processus Node permanent** qui garde des connexions ouvertes
plusieurs minutes (réponses de chat en streaming).

- **VPS Hostinger (recommandé, chemin documenté ici)** : accès SSH, Node 22, PM2, nginx.
  C'est la configuration testée par ce runbook.
- **hPanel « Node.js app » (Passenger)** : possible si l'offre souscrite propose Node
  (à vérifier dans hPanel — la disponibilité dépend du plan). Dans ce cas, le fichier de
  démarrage à indiquer est `server.js` (shim CommonJS fourni) et le panneau gère les
  variables d'environnement et le redémarrage. Les §5 (nginx) et §6 (PM2) ne s'appliquent
  pas ; le reste est identique. ⚠️ Vérifier que l'offre n'impose pas de timeout court sur
  les requêtes : au-delà de ~60 s, les réponses de chat « Complexe » seraient coupées.

Prérequis dans les deux cas : **Node ≥ 20.16** (le dépôt cible `22.x`), un domaine pointé
sur le serveur et un certificat SSL.

## 2. Où construire le site ?

`expo export -p web` est un build Metro : il demande ~2 Go de RAM et plusieurs minutes.

- **VPS ≥ 4 Go** : construire directement sur le serveur (le plus simple).
- **VPS 1–2 Go / hébergement mutualisé** : construire en local (ou en CI) puis **envoyer
  `dist/`** — c'est le chemin le plus sûr.

⚠️ **Point critique — les `EXPO_PUBLIC_*` se comportent différemment côté client et côté
serveur** (vérifié sur le build de ce dépôt) :

- **bundle client** : la valeur est **inlinée au build**. La poser sur le serveur après coup
  ne change rien ; toute modification de `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_APP_URL`,
  `EXPO_PUBLIC_DEPLOY_TARGET`… impose un **nouveau build** ;
- **routes API** (`dist/server`) : `process.env.EXPO_PUBLIC_*` reste **lu à l'exécution**.
  Absentes de l'environnement du serveur, elles valent `undefined` — la route `/api/health`
  annoncerait alors la mauvaise cible, et `serverSupabase` perdrait son repli d'URL.

👉 **Règle simple à appliquer : le même jeu de variables au build ET à l'exécution.** Garder
un `.env` unique, utilisé pour `npm run build:node` puis lu au démarrage par `npm start`.

## 3. Construire

```bash
git clone <repo> medinfo && cd medinfo
cp .env.example .env      # puis renseigner les valeurs (§4)
npm ci
npm run build:node        # expo export -p web + pré-compression Brotli/gzip
```

`build:node` produit :

- `dist/client/` — bundle web, assets, pages autonomes (`partiel.html`, `cv-builder.html`…),
  plus les variantes `.br` / `.gz` servies selon `Accept-Encoding` ;
- `dist/server/` — coquilles HTML pré-rendues + **toutes les routes API bundlées**.

Les routes API sont **autonomes** : elles n'appellent aucun paquet de `node_modules` à
l'exécution. Le seul module nécessaire au runtime est `expo-server` (~1 Mo).

### Contenu à envoyer sur le serveur (build local → upload)

```txt
dist/client/**        (~12 Mo)
dist/server/**        (~30 Mo une fois les .map supprimés)
server/**             (le serveur Node)
server.js             (shim CommonJS, requis seulement pour Passenger/hPanel)
package.json  package-lock.json
ecosystem.config.cjs  (VPS + PM2)
scripts/hostinger/**  (cron hebdo)
.env                  (jamais versionné — ou variables du panneau)
```

Puis, sur le serveur : `npm ci --omit=dev` (ou, en environnement contraint,
`npm install --omit=dev --ignore-scripts expo-server`).

Les fichiers `dist/server/**/*.map` (~30 Mo) ne servent qu'au débogage des traces :
`find dist/server -name '*.map' -delete` avant l'upload si la place est comptée.

## 4. Variables d'environnement

Toutes celles de `.env.example` restent valables (Supabase, Anthropic/OpenAI/Google, Stripe,
ANS, `CRON_SECRET`…). Le serveur lit, **par ordre de priorité** :

1. les variables du processus (panneau hPanel, `pm2`, systemd) — **elles gagnent toujours** ;
2. `.env.production.local`, `.env.local`, `.env.production`, `.env` à la racine de l'app.

Un `.env` oublié ne peut donc jamais écraser une clé posée dans le panneau.

### Nouvelles variables propres à l'auto-hébergement

| Variable | Rôle | Valeur recommandée |
|---|---|---|
| `PORT` | port d'écoute | fourni par l'hébergeur ; `3000` par défaut |
| `HOST` | interface d'écoute | `127.0.0.1` derrière nginx, `0.0.0.0` sinon |
| `TRUST_PROXY` | lire `X-Forwarded-Proto`/`X-Forwarded-Host` | laisser activé derrière un proxy ; `false` **uniquement** si Node est exposé en direct |
| `EXPO_PUBLIC_DEPLOY_TARGET` | coupe les scripts Vercel et nomme le bon hébergeur dans les mentions légales (**au build**) ; renseigne `deployTarget` dans `/api/health` (**à l'exécution**) | `hostinger`, aux deux endroits |
| `EXPO_PUBLIC_APP_URL` | URL publique (`success_url` Stripe, liens absolus) | `https://<domaine>` — **à renseigner**, ne pas dépendre de la détection d'origine |
| `EXPO_DIST_DIR` | emplacement de `dist` si l'app et le build sont séparés | inutile en général |

> ⚠️ **Mentions légales** : `EXPO_PUBLIC_DEPLOY_TARGET=hostinger` fait afficher
> « Hostinger International Ltd. (61 Lordou Vironos Street, 6023 Larnaca, Chypre) » comme
> hébergeur (obligation LCEN art. 6-III), avec un champ `[À COMPLÉTER : région du serveur]`
> à renseigner par Hugo dans `src/deploy/target.ts` une fois la région connue dans hPanel.
> La liste des sous-traitants RGPD est mise à jour en même temps.

## 5. Reverse proxy (VPS) — la partie qui casse le chat si elle est bâclée

Le chat répond **en streaming**, sur des requêtes qui peuvent durer plusieurs minutes. Un
proxy qui met en tampon ou coupe à 60 s donne exactement le symptôme « la réponse ne
s'affiche pas / s'interrompt ».

```nginx
server {
    listen 443 ssl http2;
    server_name  <domaine>;
    # ssl_certificate … (Let's Encrypt / hPanel)

    # Pièce jointe du chat : 6 Mo de fichier ⇒ ~8 Mo en base64 dans le JSON.
    client_max_body_size 16m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;   # sinon Stripe reçoit des URL http://
        proxy_set_header X-Forwarded-Host  $host;

        # ── Streaming : indispensable ────────────────────────────────────────────
        proxy_buffering off;        # sinon la réponse n'arrive qu'à la toute fin
        proxy_cache off;
        proxy_request_buffering off;
        chunked_transfer_encoding on;
        proxy_read_timeout  600s;   # une réponse « Complexe » dépasse largement 60 s
        proxy_send_timeout  600s;
    }
}
```

Le serveur Node est réglé en conséquence (`keepAliveTimeout` 75 s > keep-alive du proxy,
aucun délai d'inactivité de socket) : c'est ce qui évite les 502 sporadiques.

> Durcissement optionnel, à faire au niveau du proxy (Vercel ne les posait pas non plus, donc
> ce n'est pas une régression de la migration) : `Strict-Transport-Security`,
> `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`.
> ⚠️ Ne pas interdire l'iframe de même origine : les outils Partiels / CV / Présentation /
> Article sont des pages autonomes embarquées en iframe par l'application.

## 6. Lancer et superviser (VPS)

```bash
npm i -g pm2
pm2 start ecosystem.config.cjs --env production
pm2 save && pm2 startup        # redémarrage après reboot
pm2 logs medinfo-ai            # journaux applicatifs
```

`ecosystem.config.cjs` laisse **30 s** aux requêtes en vol avant l'arrêt : une génération de
chat en cours va au bout et s'archive (`onFinish`) au lieu d'être perdue.

Sans PM2, `npm start` lance directement `node server/index.mjs` (utile pour un premier test).

## 7. Cron hebdomadaire du blog (ADR-0025)

`vercel.json` gérait le déclenchement ; il faut désormais un cron système :

```bash
mkdir -p /home/USER/medinfo/logs        # sinon la redirection échoue et le cron est muet
crontab -e
# lundi 06:00 UTC — ajuster si le serveur n'est pas en UTC (`timedatectl`)
0 6 * * 1 /home/USER/medinfo/scripts/hostinger/weekly-blog-cron.sh >> /home/USER/medinfo/logs/weekly-blog.log 2>&1
```

Le script lit `CRON_SECRET` depuis l'environnement ou `.env` (jamais écrit dans la crontab)
et appelle `/api/cron/weekly-blog` avec le même en-tête `Authorization: Bearer …` que Vercel.
Sans `CRON_SECRET`, la route refuse (401, fail-closed) : c'est voulu.

En hPanel, créer un « Cron Job » exécutant le même script (ou un `curl` équivalent).

## 8. Recette après déploiement

```bash
curl -s https://<domaine>/api/health | jq        # ok=true, supabase.configured=true
```

1. `GET /api/health` → `ok: true`, `deployTarget: "hostinger"` (confirme que c'est bien le
   serveur Node qui répond, et non l'ancien déploiement Vercel pendant la propagation DNS),
   `supabase.hostname` = projet MedInfo, provider IA attendu.
2. Page d'accueil, `/chat`, `/pricing`, `/mentions-legales` → **l'hébergeur affiché doit être
   Hostinger**.
3. Chat : envoyer une question et vérifier que le texte arrive **au fil de l'eau** (sinon :
   `proxy_buffering off` manquant, §5).
4. Quitter l'onglet en pleine réponse, revenir : la réponse doit être retrouvée dans
   l'historique (archivage serveur).
5. Outils : `/partiel`, `/cv-builder`, `/presentation`, `/article` (pages autonomes servies
   statiquement).
6. Stripe : lancer un abonnement en mode test → l'URL de retour doit être en `https://`.
7. Webhook Stripe : repointer l'endpoint sur `https://<domaine>/api/stripe/webhook`, puis
   « Send test webhook » → 200.
8. Supabase Auth : ajouter le nouveau domaine dans **Site URL** et **Redirect URLs**, sinon
   les e-mails de confirmation pointent vers l'ancien domaine.
9. Cron : `bash scripts/hostinger/weekly-blog-cron.sh` une fois à la main (l'article part en
   brouillon dans le panel admin).

Vérification technique du serveur lui-même (statiques, cache, compression, 304, traversée de
répertoire, en-têtes de proxy), à lancer sur la machine où se trouve un build :

```bash
npm run smoke:node
```

## 9. Mettre à jour l'application

```bash
git pull
npm ci
npm run build:node
pm2 restart medinfo-ai      # ou « Restart » dans hPanel
```

Les coquilles HTML sont servies en `no-store` et les bundles portent un nom haché : après un
redémarrage, aucun client ne reste bloqué sur l'ancienne version.

## 10. Ce qui ne change pas

Supabase (base, RLS, migrations, Auth), Stripe (clés, prix, logique), les clés des providers
IA, le panel admin, les quotas et le rate-limit. La migration ne touche ni le schéma, ni les
policies, ni aucune feature IA.

## 11. Limites connues

- **Un seul processus** : les caches de configuration des features IA (`featureModel`, 60 s)
  sont en mémoire de processus — passer PM2 en mode `cluster` les multiplierait sans gain
  tant que le trafic tient sur un cœur. Le rate-limit, lui, s'appuie sur Supabase
  (`usage_counters`) et reste correct en multi-instances ; son repli mémoire ne sert que si
  `SUPABASE_SERVICE_ROLE_KEY` est absent — auquel cas un cluster ouvrirait un trou. Vérifier
  cette variable avant tout passage en cluster.
- **Pas de CDN** : les assets sont servis par le VPS. La pré-compression et les en-têtes de
  cache immuables compensent l'essentiel, mais un pic de trafic mondial se sentira. Un CDN
  devant le domaine (Cloudflare) reste possible sans modifier le code — vérifier alors que
  `X-Forwarded-Proto` est bien transmis.
- **Sauvegardes** : le VPS ne contient aucune donnée utilisateur (tout est dans Supabase),
  seulement le code et le build. La sauvegarde à surveiller reste celle de Supabase.
