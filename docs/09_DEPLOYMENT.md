# Déploiement Hostinger (Node.js) + Supabase — medinfo-ai.com

```yaml
title: Deployment Runbook
version: 2.2.0
owner: Hugo Bettembourg
status: Active
date: 2026-09-26
note: ADR-0038 — remplace le runbook Vercel (v1) ; v2.1 corrige la v2 (2026-08) sur la base de la documentation officielle Hostinger et de l'état réel du domaine ; v2.2 intègre les constats de la recette sur l'infrastructure Hostinger (2026-09-25/26)
```

## 0. État de départ (constaté le 2026-09-25)

| Élément | État |
|---|---|
| `medinfo-ai.com` | **ancien site WordPress** chez Hostinger, derrière le CDN Hostinger |
| `www.medinfo-ai.com` | CNAME vers le CDN Hostinger, 301 vers l'apex |
| DNS / registrar | Hostinger (`ns1/ns2.dns-parking.com`) |
| E-mail du domaine | Hostinger (MX `mx1/mx2.hostinger.com` + SPF) — **ne jamais toucher** |
| App en production | `refonte-med-info.vercel.app` (Vercel) |
| Offre Hostinger | `hostinger_business_v2` ; `medinfo-ai.com` est le domaine **principal** du compte (vhost `main`), les autres sites du plan sont des domaines additionnels |
| App Node Hostinger d'août | domaine temporaire `lightgoldenrodyellow-heron-372000.hostingersite.com` → **503** |

**Cause réelle du 503 (établie le 2026-09-26 dans les journaux hPanel)** : l'application
suivait `main` avec un **script de build vide**. Les builds `build:web` avaient échoué
(`Missing script: "build:web"`), le script avait ensuite été vidé : les deux seuls builds
« réussis » (17 août) n'ont exécuté que `npm install` — aucun `dist/`. À chaque réveil, le
serveur journalisait « Build web introuvable » et s'arrêtait ; le CDN répondait 503. Tous les
builds suivants (revert #144, #145, #146) ont échoué sans remplacer ce déploiement.

## 1. Architecture de déploiement

Un **processus Node unique** (`server/index.mjs`, adaptateur `expo-server/adapter/http`)
sert les fichiers statiques **et** exécute les routes API.

| Fichier | Rôle |
|---|---|
| `app.json` | `expo.web.output=server` → l'export produit `dist/client` + `dist/server`. Requis pour les routes API. |
| `server.js` | Fichier d'entrée déclaré dans hPanel — délègue à `server/index.mjs`. |
| `server/index.mjs` | Le serveur : statiques, routes Expo, en-têtes de proxy, IP client, HSTS, redirection `www`, arrêt gracieux, journal d'accès. |
| `server/lib/*.mjs` | Modules purs (cache, `.env`, proxy, écoute, diagnostic des clés Supabase `keycheck.mjs`) testés dans `tests/unit/hostinger-server.test.ts`. |
| `scripts/hostinger/precompress.mjs` | Compression Brotli/gzip au build (7,1 Mo → 1,5 Mo servis). |
| `scripts/hostinger/smoke.mjs` | Fumigation du serveur réel sur le build (`npm run smoke:node`, 19 vérifications). |
| `scripts/hostinger/weekly-blog-cron.sh` | Déclencheur du cron hebdo du blog. |
| `ecosystem.config.cjs` | Config PM2 — **uniquement** sur un VPS. |
| `app/api/health+api.ts` | Smoke-test non secret : `GET /api/health` (`deployTarget: "hostinger"`). |

> ⚠️ **Ce n'est pas un site React statique.** Un déploiement « statique » servirait les
> pages mais **aucune route API** : plus de chat, de connexion, de paiement. Il faut le mode
> **application serveur**, avec un fichier d'entrée.

## 2. Ce que Hostinger impose (documentation officielle)

Source : [docs.hostinger.com/node.js](https://docs.hostinger.com/node.js/overview). Offre
**Business** ou **Cloud** requise.

- Déploiement depuis GitHub (application GitHub Hostinger) : **on choisit la branche** ; chaque
  push sur cette branche rebâtit et redéploie ; un seul déploiement à la fois.
- Build : `npm install` (ou yarn/pnpm selon le lockfile) puis le script npm choisi —
  **15 min max** chacun. Une application « Other » avec fichier d'entrée déploie **tout le
  dossier racine**, `node_modules` et `dist/` compris.
- **Le port est attribué au démarrage** : l'application écoute `process.env.PORT`. Ne pas
  définir `PORT` soi-même.
- Variables d'environnement injectées **au build ET à l'exécution** ; les enregistrer
  **redéploie** l'application.
- Le `.htaccess` qui route vers Node est **généré** ; `hbuilds/` et `public_html` sont
  réécrits à chaque déploiement (aucune modification manuelle durable).
- **Le processus est arrêté après une période sans trafic** et relancé à la requête
  suivante ; il est relancé automatiquement en cas de crash.
- Journaux d'exécution = stdout/stderr, 5 000 lignes, dernier déploiement seulement.
- Pour rattacher un domaine déjà utilisé par un site du même plan, **retirer d'abord ce site**.

## 3. Réglages de l'application dans hPanel

hPanel → **Sites web** → application Node.js (réutiliser celle d'août, ou *Ajouter un site →
Node.js Apps → Importer un dépôt Git*). Les libellés de menus cités dans ce runbook sont
indicatifs : l'interface hPanel évolue.

| Champ | Valeur |
|---|---|
| **Framework** | **Other** (surtout pas « React » : site statique sans processus Node) |
| **Branche** | recette : `claude/vercel-hostinger-migration-rt9gsu` ; après fusion : `main` |
| **Version de Node** | **22** |
| **Répertoire racine** | `/` (vide) |
| **Script de build** | `build` (`npm run build` ; `build:web` en est un alias) |
| **Répertoire de sortie** | vide (ignoré quand un fichier d'entrée est défini) |
| **Fichier d'entrée** | `server.js` |
| **Gestionnaire de paquets** | npm (détecté via `package-lock.json`) |

Signes que c'est bon : badge **Running** + bouton **Restart** sur la carte de l'application,
et dans les *Runtime Logs* : `[medinfo] serveur prêt — port … (toutes interfaces)`.
Constaté le 2026-09-25 : `[medinfo] serveur prêt — port 3000 (toutes interfaces), node
v22.18.0, dist=…/hbuilds/versions/<build>/nodejs/dist, env: variables du processus`.

Juste après, le serveur **vérifie ses clés Supabase auprès de Supabase** (une fois par
démarrage, en tâche de fond, sans jamais écrire une clé — `server/lib/keycheck.mjs`) :

- `[medinfo] supabase : clé service_role acceptée, droits confirmés — format …` → OK ;
- `… REFUSÉE (HTTP 401 « Invalid API key ») — format sb_secret, 33 car.` → valeur erronée
  (copie tronquée, autre projet, clé révoquée) : la recopier ;
- `… INUTILISABLE (caractères interdits …) — … texte masqué « •••• » copié ?` → c'est le
  texte masqué du tableau de bord qui a été copié : utiliser le bouton *Copier* ;
- `… acceptée mais SANS droits service_role` → une clé publique a été posée à sa place ;
- mentions `espace … au bord de la valeur`, `entourée de guillemets`, `entièrement en
  MAJUSCULES`, `AUTRE projet (…)` : le défaut de copie est nommé.

C'est le seul contrôle qui prouve qu'une clé **fonctionne** : `/api/health` n'en vérifie que
la présence.

> ⚠️ **Ne jamais redéployer par l'écran « Vérifiez les paramètres de compilation »**
> (assistant d'import/redéploiement). Il repart des valeurs **détectées automatiquement**, pas
> des réglages enregistrés. Constaté le 2026-09-26 : l'écran affichait préréglage **React**,
> branche **`main`** et **aucune** variable alors que l'app était correctement réglée ; le
> redéploiement lancé depuis lui (préréglage et branche corrigés à la main) a néanmoins
> enregistré un **script de build vide** — retour immédiat du 503 (« Build web introuvable »). Pour
> redéployer : enregistrer les variables (§4), pousser sur la branche, ou relancer un build
> avec les réglages du tableau ci-dessus.

## 4. Variables d'environnement

> Ne pas importer `.env.example` tel quel : ses valeurs vides pourraient masquer celles de
> l'hébergeur (`PORT` en tête). Déclarer uniquement les variables ci-dessous.

### Règle à retenir

`EXPO_PUBLIC_*` est **inliné dans le bundle client au build** et lu **à l'exécution** par les
routes API. hPanel injecte aux deux moments : il suffit de les déclarer une fois. Toute
modification se fait dans hPanel, qui redéploie.

**Où et comment** : tableau de bord du site → *Variables d'environnement* (barre latérale) →
modifier la ligne ou *Ajouter une variable d'environnement* → *Appliquer les modifications*
(redéploie). Saisir les valeurs une par une, sans guillemets. Constats du 2026-09-25/26 :

- les valeurs sont **masquées** à la lecture (hPanel et API) et l'API **remplace toute la
  liste** : impossible de fusionner par l'API sans retaper chaque secret — les secrets se
  saisissent dans hPanel ;
- les valeurs posées en août étaient **entièrement en MAJUSCULES** (clés refusées : OpenAI
  `Incorrect API key`, Supabase 401 ; cause non établie). hPanel conserve bien la casse
  (vérifié en septembre) : en cas de doute, afficher la valeur avec l'œil ;
- `/api/health` ne vérifie que la **présence** des variables, jamais leur validité ;
- `NODE_ENV=production` fait sauter les `devDependencies` à l'installation (588 paquets au
  lieu de 638) ; le build n'en dépend pas (vérifié) ;
- enregistrer une variable **ne rebâtit pas toujours** : constaté le 2026-09-26, un simple
  redémarrage du processus (aucun build) après correction de `SUPABASE_SERVICE_ROLE_KEY`.
  Suffisant pour une variable lue par le serveur ; une variable `EXPO_PUBLIC_*` (figée dans
  le bundle au build) exige un **build** derrière (push sur la branche ou build relancé),
  puis une vérification de la valeur dans le bundle servi.

### Indispensables

| Variable | Valeur | Secret |
|---|---|---:|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://sbpnjswffrqxgnglnjml.supabase.co` | non |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | clé publishable `sb_publishable_…` (celle de la production ; protégée par RLS) | non |
| `SUPABASE_URL` | même URL | non |
| `SUPABASE_SERVICE_ROLE_KEY` | clé `service_role` | **oui** |
| `AI_PROVIDER` | `anthropic` ou `openai` | non |
| `ANTHROPIC_API_KEY` | clé Anthropic (analyse, ECOS, CV, articles, blog…) | **oui** |
| `OPENAI_API_KEY` | clé OpenAI (chat : `gpt-5.6-luna`) | **oui** |
| `GOOGLE_GENERATIVE_AI_API_KEY` | titres/catégories d'historique (`chat_meta`) | **oui** |
| `EXPO_PUBLIC_APP_URL` | recette : `https://<domaine-temporaire>` ; production : `https://medinfo-ai.com` | non |
| `EXPO_PUBLIC_AUTH_REDIRECT_URL` | **laisser vide** (= origine de la page) | non |
| `NODE_ENV` | `production` | non |

Récupérer les valeurs actuelles dans Vercel → projet `refonte-med-info` → *Settings →
Environment Variables* (les secrets sont les mêmes).

### Facturation, vérification pro, cron

| Variable | Rôle | Secret |
|---|---|---:|
| `STRIPE_SECRET_KEY` | création des sessions Checkout | **oui** |
| `STRIPE_WEBHOOK_SECRET` | signature du webhook (nouvel endpoint = nouveau `whsec_…`) | **oui** |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | clé publique — **lue nulle part dans le code** (Checkout est une redirection serveur) : facultative | non |
| `STRIPE_PRICE_PUBLIC_MID` / `STRIPE_PRICE_STUDENT_MID` / `STRIPE_PRICE_STUDENT_PREMIUM` | `price_…` des plans | non |
| `ANNUAIRE_SANTE_API_KEY` | vérification RPPS (sans clé : statut pro `pending`) | **oui** |
| `CRON_SECRET` | agent éditorial hebdo (`openssl rand -hex 32`) | **oui** |

> Sans variables Stripe, la facturation répond `503` (« non configuré ») : rien ne casse.

### Réglages serveur (optionnels)

| Variable | Défaut | Quand y toucher |
|---|---|---|
| `PORT` / `HOST` | attribué par Hostinger / toutes interfaces | **jamais chez Hostinger** (VPS : `3000` / `127.0.0.1`) |
| `TRUST_PROXY` | activé | `false` seulement si Node est exposé sans proxy |
| `TRUST_PROXY_HOPS` | `1` | `2` si le journal `[medinfo] proxy : …` indique deux derniers maillons « différents » (voir §6) |
| `CANONICAL_HOST` | dérivé de `EXPO_PUBLIC_APP_URL` | rarement |
| `ACCESS_LOG` | activé | `off` pour taire le journal d'accès |
| `EXPO_DIST_DIR` | `dist` | si le build est déposé ailleurs |

Le serveur lit aussi un `.env` à la racine (`.env.production.local`, `.env.local`,
`.env.production`, `.env`), mais **les variables du processus gagnent toujours**.

## 5. Ce que fait `npm run build`

```bash
npm run build   # expo export -p web --clear  +  pré-compression Brotli/gzip
```

> **Pourquoi `--clear`** (constaté chez Hostinger le 2026-09-26) : le cache Metro vit hors du
> dossier de build (`/tmp`) et **survit d'un build à l'autre**. Il ressert alors les modules
> déjà transformés, avec les **anciennes** valeurs `EXPO_PUBLIC_*` : variables corrigées dans
> hPanel, bundle client identique à l'octet près (le serveur, lui, lisait les nouvelles).
> Reproduit en local : sans `--clear`, une nouvelle valeur n'apparaît pas dans le bundle ;
> avec, elle y est. Coût : ~40 s de plus par build. Verrouillé par
> `tests/unit/hostinger-server.test.ts`.

- `dist/client/` — bundle web, assets, pages autonomes (`partiel.html`, `cv-builder.html`,
  `presentation.html`, `article.html`) et leurs variantes `.br`/`.gz` ;
- `dist/server/` — coquilles HTML pré-rendues + 24 routes API bundlées (seul `expo-server`
  est requis à l'exécution).

Mesuré sur ce dépôt (2026-09-25) : **~1 min**, pic mémoire **~0,5 Go** — loin de la limite
de 15 min. Chez Hostinger (2026-09-25/26) : `npm install` 7-12 s, build complet (cache froid)
**~2 min** de bout en bout ; en local avec `--clear` et l'installation de production :
61 s. En cas d'échec quand même : §11.

## 6. Streaming, proxy et CDN

Chemin d'une requête : navigateur → **CDN Hostinger** (`hcdn`, TLS) → serveur web
(LiteSpeed) → Node. Ce que fait le code :

- chat, ECOS, analyse : `Cache-Control: no-cache, no-transform` + `X-Accel-Buffering: no`
  (interdit tampon et recompression) ; toute route `/api/*` : `no-store` par défaut ;
- aucun délai d'inactivité de socket côté Node, `keepAliveTimeout` 75 s ;
- `X-Forwarded-Proto/Host` lus pour reconstruire l'URL publique (Stripe, HSTS) ;
- IP client lue à **droite** de `X-Forwarded-For` (`TRUST_PROXY_HOPS`) et réécrite pour les
  routes : un client ne peut plus contourner le quota anonyme en inventant l'en-tête ;
- `Strict-Transport-Security: max-age=63072000` derrière TLS ; `www.` → 308 vers l'apex.

Vérifié en local : fragments du chat reçus au fil de l'eau à travers le serveur ; génération
menée à terme et `onFinish` exécuté après coupure du client.

Hors de notre contrôle : délais et mise en tampon du CDN/LiteSpeed (non documentés). Si le
texte du chat n'arrive qu'à la fin, ou coupe au-delà d'une minute : 1) désactiver le CDN du
site (hPanel → *Performance → CDN*) et retester ; 2) ticket support Hostinger (« désactiver
la mise en tampon et allonger le délai de lecture pour l'application Node ») ; 3) en dernier
recours, VPS (§12).

**Réglage de `TRUST_PROXY_HOPS`** : au premier trafic, le journal affiche une ligne du type
`[medinfo] proxy : X-Forwarded-For à 2 maillon(s), deux derniers maillons identiques …`
(jamais d'adresse). « identiques » ou 1 maillon → laisser `1`. « différents » sur une
visite ordinaire → passer à `2` (le dernier maillon est le CDN).

Constaté sur le domaine temporaire (2026-09-25) : `X-Forwarded-For à 3 maillon(s), deux
derniers maillons identiques` à chaque démarrage → **`TRUST_PROXY_HOPS` laissé à 1** (ne
pas définir la variable). Les requêtes de test passaient par un proxy sortant, qui ajoute
probablement le premier maillon ; une visite ordinaire donne la même conclusion tant que
les deux derniers restent identiques. `X-Accel-Buffering` **n'arrive pas au client** (retiré
par LiteSpeed ou le CDN) : son absence côté navigateur ne dit pas s'il a été respecté — seul
le chronométrage des fragments du chat fait foi.

**Streaming mesuré à travers le CDN (2026-09-26)** : premier fragment ≈ 2 s en mode rapide,
≈ 12 s en mode standard (réflexion + recherche web) ; fragments reçus au fil de l'eau (ex. 62
fragments en 6 paquets étalés sur 1,1 s ; 166 en 1,7 s), jamais en un bloc final ; réponses
connectées de 34 à 44 s menées à terme. Aucune mise en tampon constatée → **CDN conservé**.
Reste non mesuré : une génération de plus de 60 s (délai de lecture du CDN non documenté).

## 7. Recette sur le domaine temporaire (avant de toucher au domaine)

Application hPanel sur la **branche de migration**, `EXPO_PUBLIC_APP_URL` = URL du domaine
temporaire, et ce domaine ajouté aux *Redirect URLs* de Supabase (§8, étape 5).

1. `GET https://<temporaire>/api/health` → `ok: true`, `deployTarget: "hostinger"`,
   `supabase.configured: true`, `supabase.hostname` = `sbpnjswffrqxgnglnjml.supabase.co`.
2. Accueil, `/chat`, `/pricing`, `/blog`, `/mentions-legales` (hébergeur affiché : Hostinger).
3. **Chat** : le texte arrive **au fil de l'eau** (sinon §6).
4. Chat connecté : quitter l'onglet en pleine réponse, revenir → réponse dans l'historique.
5. Connexion, inscription (e-mail de confirmation → retour sur le bon domaine), mot de passe
   oublié.
6. Outils : `/partiel`, `/cv-builder`, `/presentation`, `/article`, `/scores`, ECOS.
7. Analyse de document en invité (quota anonyme) et connecté.
8. *Runtime Logs* : lignes `[medinfo] GET /… 200 12ms`, ligne `[medinfo] proxy : …` (§6).

Constaté pendant la recette (2026-09-25/26) :

- `/api/health`, HSTS + `nosniff` sur les pages, `no-store` sur `/api/*`, pages clés en 200,
  404 sur une route inconnue, bundle servi en Brotli avec `immutable` + `ETag` : conformes ;
- le `robots.txt` du **domaine temporaire** est remplacé par le CDN (`User-agent: Googlebot`
  / `Disallow: /`, aucun de nos en-têtes) : comportement Hostinger pour `*.hostingersite.com`,
  à revérifier sur `medinfo-ai.com` le jour J (notre fichier doit y être servi) ;
- **403 du CDN** (jamais parvenus à Node) sur le premier `POST /api/chat` après une pause, à
  quatre reprises, **depuis l'IP de datacenter du conteneur de test** ; la même requête passe
  juste après ; jamais observé depuis un navigateur (Safari iPad). Probable protection
  anti-robots : à surveiller dans les journaux et les retours après la bascule ;
- `SIGTERM` reçu par le processus au basculement de chaque déploiement, à l'enregistrement
  d'une variable, et à d'autres moments sans requête en cours (parfois quelques secondes
  seulement après la dernière ; délai d'arrêt non documenté), puis redémarrage à la requête
  suivante. Une génération poursuivie ~10 s après le départ du client est allée au bout ;
  une poursuite beaucoup plus longue reste à observer (§14) ;
- **recette fonctionnelle validée (2026-09-26)** : inscription ; connexion e-mail et Google
  (après ajout du domaine temporaire aux *Redirect URLs* Supabase — sans lui, le retour de
  Google renvoyait vers le *Site URL* Vercel) ; chat invité et connecté ; génération menée à
  terme après coupure du client (`POST /api/chat 200 23070ms (client déconnecté)` puis
  écriture de fin) ; réponse archivée, conversation titrée (`chat-meta 200`), coûts
  journalisés ;
- **déploiement automatique sur push confirmé** : build lancé ~8 s après le push sur la
  branche configurée ;
- le diagnostic des clés (§3) a trouvé une `SUPABASE_SERVICE_ROLE_KEY` contenant un
  **espace** (`sb_secret`, 42 car.) → corrigée → « acceptée, droits confirmés » ;
- non posées sur le domaine temporaire (volontairement) : variables Stripe et
  `ANNUAIRE_SANTE_API_KEY` → facturation « non configurée », vérification RPPS en attente.
  À poser avant le jour J.

## 8. Bascule de `medinfo-ai.com` (le jour J)

**Prérequis** : recette §7 verte ; mentions légales complétées (éditeur, directeur de la
publication, région du serveur — cf. `src/compliance/legal.ts`, `src/deploy/hosting.ts`) ;
PR de migration relue.

1. **Sauvegarder WordPress** : hPanel → *Sauvegardes* → télécharger fichiers + base.
2. **Libérer le domaine** : retirer le site WordPress de `medinfo-ai.com` (exigence Hostinger
   pour rattacher le domaine à une autre application du plan). Si hPanel propose de
   déplacer WordPress vers un sous-domaine (ex. `ancien.medinfo-ai.com`), c'est préférable à
   une suppression. ⚠️ `medinfo-ai.com` est le domaine **principal** du compte (vhost
   `main`) : lire ce que hPanel propose pour ce cas avant toute suppression.
3. **Rattacher `medinfo-ai.com`** à l'application Node (tableau de bord de l'application →
   domaine). DNS chez Hostinger : les enregistrements web sont mis à jour par hPanel.
   **Vérifier que la messagerie est intacte** (DNS / Nameservers → zone DNS) : zone relevée
   le 2026-09-25 — apex `ALIAS` vers le CDN, `MX` 5 `mx1` / 10 `mx2.hostinger.com`, `TXT`
   SPF (`_spf.mail` + `_spf.reach.hostinger.com`), `_dmarc`, DKIM `hostingermail-a/b/c`
   (CNAME) + `hostingermail1` (TXT) + `reach-a/b` (CNAME), `autodiscover`/`autoconfig`
   (CNAME), `ftp` (A). Seuls l'apex et `www` doivent changer.
4. **SSL** : certificat actif pour `medinfo-ai.com` **et** `www.medinfo-ai.com`.
5. **Supabase** → *Authentication → URL Configuration* : **Site URL** =
   `https://medinfo-ai.com` ; **Redirect URLs** : `https://medinfo-ai.com/**` (garder le
   domaine temporaire pendant la transition, `http://localhost:8081/**` pour le dev).
6. **Stripe** → *Webhooks* : nouvel endpoint `https://medinfo-ai.com/api/stripe/webhook`
   (`checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`) → reporter le `whsec_…` dans `STRIPE_WEBHOOK_SECRET`.
7. **Couper les builds Vercel** avant la fusion : Vercel → projet `refonte-med-info` →
   *Settings → Git* → déconnecter le dépôt (ou *Ignored Build Step* = `exit 0`). Sans
   `vercel.json`, un build de `main` casserait `refonte-med-info.vercel.app` ; le dernier
   déploiement reste servi tel quel.
8. **Fusionner** la PR dans `main`, puis passer la branche de l'application hPanel sur
   `main` et `EXPO_PUBLIC_APP_URL` sur `https://medinfo-ai.com`. Jamais dans cet ordre
   inverse : avant la fusion, `main` n'a ni `server.js` ni script `build` (cause du 503
   d'août). L'enregistrement de la variable pouvant ne provoquer qu'un redémarrage (§4),
   **lancer ensuite un build de `main`** (API, ou push) et vérifier que le bundle servi
   contient `https://medinfo-ai.com` ; jamais par l'assistant « Vérifiez les paramètres de
   compilation » (§3).
9. **Vérifier** :
   ```bash
   curl -sI http://medinfo-ai.com/            # 301 → https://medinfo-ai.com/
   curl -sI https://www.medinfo-ai.com/chat   # 308 → https://medinfo-ai.com/chat
   curl -s  https://medinfo-ai.com/api/health # deployTarget: "hostinger"
   curl -sI https://medinfo-ai.com/ | grep -i strict-transport-security
   ```
   puis la recette §7 sur le vrai domaine, et un paiement Stripe en mode test (retour en
   `https://medinfo-ai.com/account?billing=success`).
10. **Cron** : §9.

## 9. Cron hebdo du blog

hPanel → *Avancé → Tâches Cron* → commande personnalisée, lundi 06:00 (`0 6 * * 1`, heure
du serveur) :

```bash
curl -fsS -m 900 -H "Authorization: Bearer <CRON_SECRET>" https://medinfo-ai.com/api/cron/weekly-blog >> $HOME/weekly-blog.log 2>&1
```

Variante sans le secret dans la ligne de cron : créer `~/.medinfo-cron.env`
(`CRON_SECRET=…`, gestionnaire de fichiers) puis
`bash ~/domains/medinfo-ai.com/hbuilds/current/nodejs/scripts/hostinger/weekly-blog-cron.sh >> $HOME/weekly-blog.log 2>&1`.

Le pipeline dure plusieurs minutes. Si le proxy coupe la connexion avant la fin, `curl`
signale une erreur mais le pipeline continue côté serveur : vérifier l'onglet **Blog** du
panel admin (brouillon ou article publié). Test manuel : bouton admin (`?force=1`).

## 10. Retour arrière

- **Avant la fusion** : rien à défaire — Vercel sert toujours `main`.
- **Après la bascule** : le dernier déploiement Vercel reste en ligne sur
  `refonte-med-info.vercel.app` tant que le projet existe (builds coupés, §8.7). Pour revenir
  à WordPress : restaurer la sauvegarde de l'étape 8.1 sur le domaine.

## 11. Repli : build hors de l'hébergeur

Si le build échoue sur Hostinger : bâtir en local avec **les mêmes variables**, puis
déployer par **archive ZIP** (hPanel → *Importer des fichiers*) contenant `dist/`,
`server/`, `server.js`, `package.json`, `package-lock.json`, `.npmrc`, `scripts/hostinger/`,
avec un **script de build vide**. `find dist/server -name '*.map' -delete` allège l'archive.

## 12. VPS (si l'hébergement géré ne suffit pas)

`PORT=3000`, `HOST=127.0.0.1`, PM2 (`ecosystem.config.cjs`), nginx devant :

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host              $host;
    proxy_set_header X-Forwarded-Proto $scheme;   # sinon Stripe reçoit des URL http://
    proxy_set_header X-Forwarded-Host  $host;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_buffering off;          # sinon la réponse n'arrive qu'à la toute fin
    proxy_request_buffering off;
    proxy_read_timeout 600s;
    proxy_send_timeout 600s;
    client_max_body_size 16m;     # pièce jointe 6 Mo ⇒ ~8 Mo en base64
}
```

## 13. Notes Supabase (inchangées)

- `supabase/migrations/` reste la source versionnée du schéma.
- `profiles` est lu côté client avec la clé `anon` et la RLS.
- `ai_interactions` est écrit côté serveur avec `service_role`, jamais accessible au client.

## 14. Limites connues

- **Arrêt à l'inactivité** : premier accès après une pause = démarrage à froid. Une
  génération de chat poursuivie après le départ du client peut être interrompue si
  l'hébergeur arrête le processus pendant ce temps (délai non documenté). Rien d'autre ne vit
  en mémoire : état dans Supabase.
- **Un seul processus** : caches de configuration IA (60 s) par processus ; rate-limit dans
  Supabase (`usage_counters`), correct même à plusieurs processus.
- **Sauvegardes** : le serveur ne contient aucune donnée utilisateur ; la sauvegarde à
  surveiller reste celle de Supabase.

## 15. Mobile natif

Le chat mobile utilise aussi `/api/chat`. Avant une build native de production, définir
l'origine serveur (`https://medinfo-ai.com`) selon la stratégie Expo Router retenue et la
documenter dans une ADR.
