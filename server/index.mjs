#!/usr/bin/env node
/**
 * Serveur Node autonome de MedInfo AI — cible Hostinger (hPanel « Node.js Web Apps » ou VPS).
 *
 * Ce processus unique sert à la fois
 *   - les fichiers statiques de `dist/client` ;
 *   - les coquilles HTML pré-rendues et TOUTES les routes `+api.ts` de `dist/server`,
 *     via `expo-server/adapter/http`.
 *
 * Démarrage : `npm run build` (une fois) puis `npm start`.
 * Variables : `PORT` (attribué par l'hébergeur), `HOST`, `TRUST_PROXY`, `TRUST_PROXY_HOPS`,
 * `CANONICAL_HOST`, plus toutes les variables applicatives (voir `.env.example` et
 * docs/09_DEPLOYMENT.md).
 *
 * Différence de fond avec l'ancien hébergement serverless : le processus reste vivant
 * entre les requêtes. La génération d'une réponse de chat continue donc jusqu'au bout même
 * si le client se déconnecte (`consumeStream()` dans `/api/chat`), et l'archivage
 * `onFinish` s'exécute normalement — `keepAlive()` n'a plus qu'à neutraliser un rejet.
 * Nuance Hostinger : l'hébergeur ARRÊTE le processus après une période sans trafic et le
 * relance à la requête suivante (docs.hostinger.com/node.js/overview) — rien ne doit donc
 * vivre uniquement en mémoire (c'est le cas : l'état est dans Supabase).
 */
import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadEnvFiles } from './lib/env.mjs';
import { checkSupabaseKeys } from './lib/keycheck.mjs';
import {
  CLIENT_IP_HEADERS,
  canonicalHostFrom,
  canonicalRedirect,
  parseTrustedHops,
  resolveClientIp,
  resolveForwarded,
  resolveListenTarget,
  withRawHeader,
  withoutRawHeaders,
} from './lib/proxy.mjs';
import { createBlogPrerender, publicSiteUrl } from './lib/blog-prerender.mjs';
import { BUILD_HEADER, readBuildId } from './lib/build-id.mjs';
import { createHtmlHandler } from './lib/html.mjs';
import {
  BASE_SECURITY_HEADERS,
  buildCsp,
  cspHeaderName,
  cspModeFrom,
  extraConnectOrigins,
  inlineScriptHashes,
} from './lib/security.mjs';
import { createStaticHandler } from './lib/serve-static.mjs';
import { NO_STORE_CACHE_CONTROL } from './lib/static.mjs';

/**
 * ⚠️  `expo-server` doit être chargé par `require`, PAS par `import`.
 *
 * Le paquet publie deux builds (`build/mjs` et `build/cjs`) mais la build ESM utilise des
 * imports relatifs sans extension (`./abstract`) — invalides pour le résolveur ESM de Node —
 * et appelle `require()` dans `environment/node`, qui n'existe pas en ESM. Seule la build
 * CommonJS, sélectionnée par la condition `require` du champ `exports`, fonctionne hors
 * bundler. `createRequire` permet de la charger depuis ce module ESM.
 * Vérifié sur expo-server 56.0.4 ; à re-tester lors d'une montée de version d'Expo
 * (`npm run smoke:node` couvre exactement ce chemin).
 */
const require = createRequire(import.meta.url);
/** @type {{ createRequestHandler: Function }} */
const { createRequestHandler } = require('expo-server/adapter/http');

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SERVER_DIR, '..');

const DIST_DIR = process.env.EXPO_DIST_DIR
  ? path.resolve(PROJECT_ROOT, process.env.EXPO_DIST_DIR)
  : path.join(PROJECT_ROOT, 'dist');
const CLIENT_DIR = path.join(DIST_DIR, 'client');
const BUILD_DIR = path.join(DIST_DIR, 'server');

/** HSTS : 2 ans, comme l'ancienne plateforme le posait. Sans `includeSubDomains` : on ne présume rien des sous-domaines. */
const HSTS_VALUE = 'max-age=63072000';

/** Erreurs de flux normales quand un client ferme l'onglet en pleine réponse. */
const CLIENT_DISCONNECT_CODES = new Set([
  'ABORT_ERR',
  'ECONNABORTED',
  'ECONNRESET',
  'EPIPE',
  'ERR_STREAM_PREMATURE_CLOSE',
]);

/** @param {unknown} error */
function isClientDisconnect(error) {
  if (!error || typeof error !== 'object') return false;
  const { name, code } = /** @type {{ name?: string; code?: string }} */ (error);
  return name === 'AbortError' || (typeof code === 'string' && CLIENT_DISCONNECT_CODES.has(code));
}

/** HSTS n'a de sens que sur un vrai nom de domaine servi en HTTPS (jamais localhost ni une IP). */
function wantsHsts(protocol, host) {
  if (protocol !== 'https' || !host) return false;
  const hostname = host.replace(/:\d+$/, '').replace(/^\[|\]$/g, '').toLowerCase();
  return hostname !== 'localhost' && !hostname.endsWith('.localhost') && net.isIP(hostname) === 0;
}

function assertBuildExists() {
  const missing = [CLIENT_DIR, BUILD_DIR].filter((dir) => !fs.existsSync(dir));
  if (missing.length === 0) return;
  console.error(
    [
      '[medinfo] Build web introuvable :',
      ...missing.map((dir) => `  - ${dir}`),
      '',
      'Construire le site avant de démarrer le serveur :',
      '  npm run build',
      '',
      'Chez Hostinger : vérifier que la « commande de build » du déploiement vaut `build`',
      '(npm run build) et que le fichier d’entrée est `server.js`.',
      'Les variables EXPO_PUBLIC_* doivent être présentes AU MOMENT DU BUILD',
      '(elles sont figées dans le bundle client).',
    ].join('\n'),
  );
  process.exit(1);
}

export function createServer() {
  const trustProxy = process.env.TRUST_PROXY !== 'false' && process.env.TRUST_PROXY !== '0';
  const hops = parseTrustedHops(process.env.TRUST_PROXY_HOPS);
  const canonicalHost = canonicalHostFrom(process.env);

  // CSP des documents HTML (docs/03_SECURITY.md §10, ADR-0042) : empreintes des scripts
  // inline de CHAQUE document, calculées une fois par fichier. `CSP=off|report-only` :
  // interrupteur d'exploitation (redémarrage), jamais nécessaire en temps normal.
  const cspHeader = cspHeaderName(cspModeFrom(process.env));
  const connectExtra = extraConnectOrigins(process.env.EXPO_PUBLIC_SUPABASE_URL);
  /** @param {string} html */
  const documentHeaders = (html) =>
    cspHeader ? { [cspHeader]: buildCsp({ scriptHashes: inlineScriptHashes(html), connectExtra }) } : {};

  // Version servie (empreinte du bundle d'entrée) : annoncée sur les réponses d'API pour que
  // les onglets restés sur l'ancien code proposent de recharger (server/lib/build-id.mjs).
  const buildId = readBuildId(CLIENT_DIR);

  const serveStatic = createStaticHandler({
    root: CLIENT_DIR,
    htmlHeaders: documentHeaders,
    onError: (error) => {
      if (!isClientDisconnect(error)) console.error('[medinfo] erreur de lecture statique :', error);
    },
  });

  // Blog : métadonnées et texte des articles dans le HTML servi, pour les aperçus de liens et
  // les robots qui n'exécutent pas JavaScript (server/lib/blog-prerender.mjs). Clé ANON :
  // la RLS ne montre que les articles publiés. Sans configuration Supabase : inactif.
  const blogPrerender = createBlogPrerender({
    supabaseUrl: process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL,
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    siteUrl: () => publicSiteUrl(process.env),
  });

  // Coquilles HTML d'Expo servies compressées, avec `charset` et CSP (server/lib/html.mjs).
  const serveHtml = createHtmlHandler({
    buildDir: BUILD_DIR,
    headersFor: documentHeaders,
    enrich: blogPrerender.enabled ? blogPrerender.enrich : undefined,
    onUnsupported: (reason) =>
      console.warn(`[medinfo] pages HTML servies par le moteur Expo (sans compression ni CSP) : ${reason}.`),
  });

  const handleExpoRequest = createRequestHandler(
    { build: BUILD_DIR, environment: process.env.NODE_ENV ?? 'production' },
    {
      // Les coquilles HTML ne doivent jamais être mises en cache, sinon un déploiement
      // laisse des clients sur l'ancien bundle.
      beforeHTMLResponse(responseInit) {
        if (!responseInit.headers.has('cache-control')) {
          responseInit.headers.set('cache-control', NO_STORE_CACHE_CONTROL);
        }
        // Repli (manifeste non pris en charge par serveHtml) : au moins le jeu de caractères,
        // que la balise <meta charset> — rejetée après les balises SEO — ne garantit pas.
        responseInit.headers.set('content-type', 'text/html; charset=utf-8');
        return responseInit;
      },
    },
  );

  // Journal d'accès (lu dans les « Runtime Logs » hPanel). Volontairement limité au
  // CHEMIN (jamais la query string, jamais un en-tête, jamais un corps, jamais une IP) —
  // aucune donnée utilisateur ni contenu de message ne doit atterrir dans les logs
  // (03_SECURITY §6). Les fichiers statiques ne sont pas journalisés : ils noieraient les
  // lignes utiles.
  const accessLog = process.env.ACCESS_LOG !== 'off' && process.env.ACCESS_LOG !== '0';

  // Diagnostic unique par processus : combien de proxys ont écrit dans X-Forwarded-For.
  // Sert à régler TRUST_PROXY_HOPS sans jamais journaliser une adresse (donnée personnelle).
  let proxyChainLogged = false;

  return http.createServer(async (req, res) => {
    const startedAt = accessLog ? Date.now() : 0;
    try {
      const forwarded = resolveForwarded(req.headers, {
        trustProxy,
        encrypted: Boolean(/** @type {{ encrypted?: boolean }} */ (req.socket).encrypted),
      });

      if (trustProxy) {
        // L'adaptateur Expo construit l'URL depuis `req.socket.encrypted` et `headers.host`.
        // Derrière le proxy Hostinger (TLS terminé en amont), les deux sont faux : on les
        // réaligne pour que `new URL(request.url)` rende l'URL PUBLIQUE côté routes API.
        // Valeur posée à CHAQUE requête : le proxy réutilise ses connexions vers Node pour
        // des clients différents, une valeur « collante » déborderait d'une requête à l'autre.
        Object.defineProperty(req.socket, 'encrypted', {
          value: forwarded.protocol === 'https',
          configurable: true,
          enumerable: false,
          writable: true,
        });
        if (forwarded.host) req.headers.host = forwarded.host;
      }

      // Adresse client unique et non falsifiable pour le rate-limit anonyme
      // (src/ai/rateLimit/chatRateLimit.ts lit X-Forwarded-For). ⚠️ L'adaptateur Expo lit
      // `req.rawHeaders`, pas `req.headers` : c'est `rawHeaders` qu'il faut réécrire.
      const clientIp = resolveClientIp(req.headers, {
        trustProxy,
        hops,
        remoteAddress: req.socket.remoteAddress,
      });
      if (!proxyChainLogged && trustProxy && req.headers['x-forwarded-for']) {
        proxyChainLogged = true;
        const chain = String(req.headers['x-forwarded-for'])
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean);
        // « identiques » : le serveur web a recopié l'IP réelle transmise par le CDN → 1 suffit.
        // « différents » sur une requête de navigateur ordinaire : le dernier maillon est
        // probablement le CDN → TRUST_PROXY_HOPS=2 (docs/09_DEPLOYMENT.md §6).
        const lastTwo =
          chain.length >= 2
            ? `, deux derniers maillons ${chain.at(-1) === chain.at(-2) ? 'identiques' : 'différents'}`
            : '';
        console.log(
          `[medinfo] proxy : X-Forwarded-For à ${chain.length} maillon(s)${lastTwo} ; client lu au ` +
            `maillon ${Math.min(hops, chain.length)} depuis la droite (TRUST_PROXY_HOPS=${hops}).`,
        );
      }
      if (clientIp) {
        req.rawHeaders = withRawHeader(
          withRawHeader(withoutRawHeaders(req.rawHeaders, CLIENT_IP_HEADERS), 'x-forwarded-for', clientIp),
          'x-real-ip',
          clientIp,
        );
        req.headers['x-forwarded-for'] = clientIp;
        req.headers['x-real-ip'] = clientIp;
        delete req.headers['cf-connecting-ip'];
      } else {
        // Aucune adresse fiable (socket Unix sans en-tête de proxy) : on retire les en-têtes
        // fournis par le client plutôt que de les laisser lire au rate-limit.
        req.rawHeaders = withoutRawHeaders(req.rawHeaders, CLIENT_IP_HEADERS);
        for (const name of CLIENT_IP_HEADERS) delete req.headers[name];
      }

      // `www.` ↔ apex du domaine canonique uniquement (voir canonicalRedirect) : une seule
      // origine, donc une seule session (localStorage) et des URL Supabase/Stripe cohérentes.
      const location = canonicalRedirect({ host: forwarded.host, url: req.url, canonicalHost });
      if (location) {
        res.statusCode = 308;
        res.setHeader('Location', location);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.end();
        return;
      }

      for (const [name, value] of Object.entries(BASE_SECURITY_HEADERS)) res.setHeader(name, value);
      if (wantsHsts(forwarded.protocol, forwarded.host)) {
        res.setHeader('Strict-Transport-Security', HSTS_VALUE);
      }

      if (await serveStatic(req, res)) return;

      const pathname = (req.url ?? '').split('?')[0];

      if (await serveHtml(req, res)) {
        if (accessLog) {
          console.log(`[medinfo] ${req.method} ${pathname} ${res.statusCode} ${Date.now() - startedAt}ms`);
        }
        return;
      }

      if (pathname === '/api' || pathname.startsWith('/api/')) {
        // Valeurs PAR DÉFAUT (une route qui pose les siennes les remplace) : jamais de cache
        // d'une réponse d'API par le CDN, jamais de mise en tampon d'un flux par le proxy.
        res.setHeader('Cache-Control', NO_STORE_CACHE_CONTROL);
        res.setHeader('X-Accel-Buffering', 'no');
        if (buildId) res.setHeader(BUILD_HEADER, buildId);
      }

      if (accessLog) {
        res.once('close', () => {
          const state = res.writableEnded ? '' : ' (client déconnecté)';
          console.log(
            `[medinfo] ${req.method} ${pathname} ${res.statusCode} ${Date.now() - startedAt}ms${state}`,
          );
        });
      }

      await handleExpoRequest(req, res, (error) => {
        if (!error) {
          if (!res.headersSent) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.end('Not found');
          } else if (!res.writableEnded) {
            res.end();
          }
          return;
        }
        if (isClientDisconnect(error)) {
          // Onglet fermé / réseau coupé pendant le streaming : la génération continue
          // côté serveur et sera archivée. Rien à signaler.
          if (!res.writableEnded) res.destroy();
          return;
        }
        console.error('[medinfo] erreur de route :', error);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end('Internal Server Error');
        } else if (!res.writableEnded) {
          res.end();
        }
      });
    } catch (error) {
      if (isClientDisconnect(error)) {
        if (!res.writableEnded) res.destroy();
        return;
      }
      console.error('[medinfo] erreur non rattrapée :', error);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('Internal Server Error');
      } else if (!res.writableEnded) {
        res.end();
      }
    }
  });
}

export function start() {
  const { files } = loadEnvFiles(PROJECT_ROOT);
  process.env.NODE_ENV ??= 'production';

  assertBuildExists();

  const target = resolveListenTarget(process.env);
  const server = createServer();

  // Le proxy de l'hébergeur garde les connexions ouvertes : la fenêtre keep-alive du
  // serveur Node doit lui être SUPÉRIEURE, sinon des 502 sporadiques apparaissent quand le
  // proxy réutilise une connexion que Node vient de fermer.
  server.keepAliveTimeout = 75_000;
  server.headersTimeout = 80_000;
  // Une réponse de chat « complexe » dure plusieurs minutes : aucun délai d'inactivité de
  // socket côté serveur (la limite réelle est celle du proxy, voir la doc de déploiement).
  server.timeout = 0;

  server.on('clientError', (error, socket) => {
    if (!socket.writable || socket.destroyed) return;
    if (isClientDisconnect(error)) {
      socket.destroy();
      return;
    }
    socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
  });

  server.on('error', (error) => {
    if (!server.listening) {
      // EADDRINUSE, EACCES… au démarrage : sans ce message, l'hébergeur n'affiche qu'un
      // 503 muet. Sortie en erreur → l'hébergeur relance le processus.
      console.error('[medinfo] écoute impossible :', error);
      process.exit(1);
    }
    // Après le démarrage (ex. EMFILE transitoire à l'acceptation) : on journalise sans
    // couper le service de tous les utilisateurs.
    console.error('[medinfo] erreur serveur :', error);
  });

  const where =
    'path' in target
      ? `socket ${target.path}`
      : `port ${target.port}${target.host ? ` (${target.host})` : ' (toutes interfaces)'}`;
  server.listen(target, () => {
    console.log(
      `[medinfo] serveur prêt — ${where}, node ${process.version}, dist=${DIST_DIR}` +
        (files.length ? `, env: ${files.join(', ')}` : ', env: variables du processus'),
    );
    // `/api/health` ne vérifie que la PRÉSENCE des clés : une clé présente mais refusée
    // (constat de recette 2026-09) cassait l'archivage du chat sans rien signaler. Une fois
    // par démarrage, en tâche de fond, sans jamais écrire une clé (server/lib/keycheck.mjs).
    checkSupabaseKeys(process.env)
      .then((lines) => {
        for (const { level, text } of lines) console[level](text);
      })
      .catch(() => {});
  });

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[medinfo] ${signal} reçu — arrêt en cours (fin des réponses en vol).`);
    server.close(() => process.exit(0));
    // Les connexions keep-alive INACTIVES ne doivent pas retarder l'arrêt ; celles qui
    // portent une réponse en cours sont préservées jusqu'au délai ci-dessous.
    server.closeIdleConnections?.();
    // Filet de sécurité : une génération de chat très longue ne doit pas bloquer un
    // redémarrage indéfiniment.
    const timer = setTimeout(() => {
      console.warn('[medinfo] arrêt forcé après 25 s.');
      process.exit(0);
    }, 25_000);
    timer.unref?.();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    if (isClientDisconnect(reason)) return;
    console.error('[medinfo] promesse rejetée non gérée :', reason);
  });

  return server;
}

// Démarrage direct (`node server/index.mjs`) ou via le shim CommonJS `server.js`.
// Sous un gestionnaire de type Passenger, le module est chargé en tant qu'entrée : on
// démarre aussi.
const invokedDirectly =
  process.argv[1] === fileURLToPath(import.meta.url) || process.env.MEDINFO_AUTOSTART === '1';

if (invokedDirectly) {
  start();
}
