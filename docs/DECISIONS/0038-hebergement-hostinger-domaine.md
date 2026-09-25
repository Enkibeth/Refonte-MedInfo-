# ADR-0038 — Hébergement chez Hostinger (serveur Node autonome) et domaine medinfo-ai.com

```yaml
status: Accepted
date: 2026-09-25
owner: Hugo Bettembourg
linked_to: [ADR-0002, ADR-0004, ADR-0012, ADR-0024, ADR-0025, ADR-0037, 03_SECURITY §6, 09_DEPLOYMENT]
supersedes_note: "Remplace la cible de déploiement Vercel d'ADR-0002 et le §10 de 02_ARCHITECTURE (DNS repointé vers Vercel). ADR-0004 (garder le domaine chez Hostinger, ne pas le transférer) reste valable : seule la destination change — le domaine pointe désormais vers l'hébergement Hostinger lui-même."
```

## Contexte

Demande Hugo : faire fonctionner le site sur Hostinger, puis sur `medinfo-ai.com`.

Historique : une première migration (PR #142 + #143, 2026-08-16/17) a été fusionnée puis
intégralement annulée (#144) le lendemain, sans ADR. Le domaine temporaire créé à l'époque
chez Hostinger répond aujourd'hui **503** (constaté). Cause la plus probable, non vérifiable
sans accès à hPanel : l'application Node, reliée à `main`, n'y trouve plus ni `server.js` ni
script `build` depuis le revert.

État constaté le 2026-09-25 (requêtes DNS et HTTP publiques) :

| Élément | Valeur |
|---|---|
| Registrar / DNS | Hostinger (`ns1/ns2.dns-parking.com`) |
| `medinfo-ai.com` | **ancien site WordPress** (thème Astra, PHP 8.3) chez Hostinger, derrière le CDN Hostinger (`server: hcdn`) |
| `www.medinfo-ai.com` | CNAME `www.medinfo-ai.com.cdn.hstgr.net` → 301 vers l'apex (redirection WordPress) |
| E-mail | MX `mx1/mx2.hostinger.com` + SPF Hostinger — **à préserver** |
| Production actuelle de l'app | `refonte-med-info.vercel.app` (seul domaine du projet Vercel), saine |

Faits Hostinger vérifiés dans la documentation officielle (docs.hostinger.com/node.js) :
offre Business ou Cloud ; déploiement depuis GitHub avec **choix de la branche** ; build
`npm install` puis script npm (15 min max chacun) ; préréglage **Other** + fichier d'entrée
à la racine (`.js`/`.mjs`/`.cjs`) ; **le port est attribué à l'exécution** (écouter
`process.env.PORT`) ; variables injectées **au build et à l'exécution**, leur enregistrement
**redéploie** ; `.htaccess` généré automatiquement ; **processus arrêté après une période
sans trafic** et relancé à la requête suivante, redémarré en cas de crash ; journaux
d'exécution = stdout/stderr (5 000 lignes, dernier déploiement) ; pour rattacher un domaine
déjà utilisé par un site du même plan, il faut d'abord retirer ce site.

## Décision

1. **Un seul processus Node** (`server/index.mjs`, entrée hPanel `server.js`) sert
   `dist/client` et toutes les routes `+api.ts` via `expo-server/adapter/http`. Vercel est
   retiré du dépôt (`vercel.json`, `api/index.js`, `scripts/vercel/`, analytics Vercel).
   Reprise du travail des PR #142/#143 (revert du revert #144), corrigée :

   | Défaut de la version d'août | Correction |
   |---|---|
   | Écoute forcée sur `0.0.0.0` (IPv4 seul) + `PORT` supposé numérique | Écoute sans hôte (IPv4 + IPv6, comme l'exemple Express de Hostinger) ; `PORT` non numérique = socket (au lieu d'un crash `NaN`) ; message explicite si l'écoute échoue. Deux causes plausibles d'un 503 muet. |
   | IP client = PREMIÈRE entrée de `X-Forwarded-For` → falsifiable : quota anonyme de `/api/analyze` contournable (appels LLM illimités) | IP lue à droite (`TRUST_PROXY_HOPS`, défaut 1), réécrite dans `req.rawHeaders` — l'adaptateur Expo reconstruit les en-têtes depuis `rawHeaders` : modifier `req.headers` n'avait AUCUN effet. Démontré par la fumigation (échoue sans le correctif). |
   | `socket.encrypted` posé une fois et jamais remis à `false` sur une connexion keep-alive réutilisée | Posé à chaque requête. |
   | Streaming : rien n'empêchait LiteSpeed/CDN de tamponner ou recompresser | `Cache-Control: no-cache, no-transform` + `X-Accel-Buffering: no` sur chat/ECOS/analyse ; défauts `no-store` + `X-Accel-Buffering: no` sur `/api/*`. |
   | HSTS perdu (Vercel le posait) | `Strict-Transport-Security: max-age=63072000` derrière TLS, jamais en local. |
   | Cron : script lisant un `.env` à la racine et un port local fixe — inexistants en hébergement géré | URL publique par défaut, secret dans `~/.medinfo-cron.env` ou commande `curl` directe dans hPanel. |
   | URL canonique = domaine temporaire ; `robots.txt` = vercel.app | `https://medinfo-ai.com` partout, cohérence verrouillée par test. |

2. **Domaine canonique `medinfo-ai.com` (apex)**. `www.` est redirigé en 308 vers l'apex par
   le serveur (une seule origine = une seule session `localStorage`, des URL Supabase/Stripe
   cohérentes, pas de contenu dupliqué). Aucun autre hôte n'est redirigé : la recette se fait
   sur le domaine temporaire Hostinger alors que la configuration vise déjà le vrai domaine.

3. **Bascule en deux temps, sans casser la production** :
   - recette sur le domaine temporaire, l'application hPanel pointant sur la **branche de
     migration** (Vercel continue de servir `main`, intacte) ;
   - le jour J : sauvegarde WordPress → retrait du site WordPress du domaine → rattachement de
     `medinfo-ai.com` à l'application Node → variables de production → fusion dans `main`.
   Avant la fusion, **couper les builds Vercel** : sans `vercel.json`, un build de `main`
   produirait un déploiement cassé sur `refonte-med-info.vercel.app`.

## Conséquences

- (+) Un seul fournisseur (domaine, DNS, e-mail, hébergement) ; sous-traitant européen
  (Hostinger International Ltd., Chypre) au lieu d'un prestataire américain. Nuance : les
  points de présence du CDN sont mondiaux (un visiteur hors UE transite par un nœud hors UE).
- (+) Plus de gel serverless : la génération d'une réponse de chat va au bout après
  déconnexion du client (vérifié : `onFinish` exécuté après coupure).
- (−) **Arrêt à l'inactivité** : premier accès après une pause = démarrage à froid ; une
  génération entamée par un client parti pourrait être interrompue si l'hébergeur arrête le
  processus pendant ce temps (délai non documenté). L'état vit dans Supabase : rien d'autre
  n'est perdu. À surveiller via les « (client déconnecté) » des journaux et l'historique.
- (−) **Proxy et CDN hors de notre contrôle** : délais d'attente et mise en tampon non
  documentés par Hostinger. Levier en cas de souci : désactiver le CDN du site dans hPanel,
  puis ticket support. Sur VPS, la configuration nginx du runbook s'applique.
- (−) **Build sur l'hébergeur** : mesuré à ~1 min et ~0,5 Go (pic RSS) — sous la limite de
  15 min. Repli documenté : archive ZIP avec `dist/` pré-construit et script de build vide.
- (−) Les mentions légales doivent nommer l'hébergeur réel : `src/deploy/hosting.ts`. La
  région du serveur et le téléphone de l'hébergeur (LCEN art. 6-III) restent à compléter
  depuis hPanel — jamais devinés.
- Aucune table, policy ou migration touchée. Aucune couche de régulation retirée.

## Suivi

- Après bascule : lire la ligne `[medinfo] proxy : …` des journaux et régler
  `TRUST_PROXY_HOPS` (docs/09_DEPLOYMENT.md §3).
- Après deux semaines stables : supprimer le projet Vercel (ou le rediriger vers le domaine).
- Compléter les champs « [À COMPLÉTER] » des mentions légales AVANT l'ouverture publique.
