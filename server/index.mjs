#!/usr/bin/env node
/**
 * Serveur Node autonome de MedInfo AI — cible Hostinger (hPanel « Node.js app » ou VPS).
 *
 * Ce processus unique sert à la fois
 *   - les fichiers statiques de `dist/client` ;
 *   - les coquilles HTML pré-rendues et TOUTES les routes `+api.ts` de `dist/server`,
 *     via `expo-server/adapter/http`.
 *
 * Démarrage : `npm run build` (une fois) puis `npm start`.
 * Variables : `PORT` (fourni par l'hébergeur), `HOST`, `TRUST_PROXY`, plus toutes les
 * variables applicatives (voir `.env.example` et docs/09_DEPLOYMENT.md).
 *
 * Différence de fond avec l'ancien hébergement serverless : le processus reste vivant
 * entre les requêtes. La génération d'une réponse de chat continue donc jusqu'au bout même
 * si le client se déconnecte (`consumeStream()` dans `/api/chat`), et l'archivage
 * `onFinish` s'exécute normalement — `keepAlive()` devient un no-op assumé.
 */
import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadEnvFiles } from './lib/env.mjs';
import { resolveForwarded } from './lib/proxy.mjs';
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
      'Les variables EXPO_PUBLIC_* doivent être présentes AU MOMENT DU BUILD',
      '(elles sont figées dans le bundle client).',
    ].join('\n'),
  );
  process.exit(1);
}

export function createServer() {
  const trustProxy = process.env.TRUST_PROXY !== 'false' && process.env.TRUST_PROXY !== '0';

  const serveStatic = createStaticHandler({
    root: CLIENT_DIR,
    onError: (error) => {
      if (!isClientDisconnect(error)) console.error('[medinfo] erreur de lecture statique :', error);
    },
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
        return responseInit;
      },
    },
  );

  // Journal d'accès (lu dans les « Runtime Logs » hPanel). Volontairement limité au
  // CHEMIN (jamais la query string, jamais un en-tête, jamais un corps) — aucune donnée
  // utilisateur ni contenu de message ne doit atterrir dans les logs (03_SECURITY §6).
  // Les fichiers statiques ne sont pas journalisés : ils noieraient les lignes utiles.
  const accessLog = process.env.ACCESS_LOG !== 'off' && process.env.ACCESS_LOG !== '0';

  return http.createServer(async (req, res) => {
    const startedAt = accessLog ? Date.now() : 0;
    try {
      if (trustProxy) {
        const { protocol, host } = resolveForwarded(req.headers, {
          trustProxy: true,
          encrypted: Boolean(/** @type {{ encrypted?: boolean }} */ (req.socket).encrypted),
        });
        // L'adaptateur Expo construit l'URL depuis `req.socket.encrypted` et `headers.host`.
        // Derrière le proxy Hostinger (TLS terminé en amont), les deux sont faux : on les
        // réaligne ici pour que `new URL(request.url)` rende bien l'URL PUBLIQUE côté routes
        // API (Stripe `success_url`, liens absolus…).
        if (protocol === 'https') {
          Object.defineProperty(req.socket, 'encrypted', {
            value: true,
            configurable: true,
            enumerable: false,
          });
        }
        if (host) req.headers.host = host;
      }

      if (await serveStatic(req, res)) return;

      if (accessLog) {
        const pathname = (req.url ?? '').split('?')[0];
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

  const port = Number.parseInt(process.env.PORT ?? '3000', 10);
  const host = process.env.HOST ?? '0.0.0.0';
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

  server.listen(port, host, () => {
    console.log(
      `[medinfo] serveur prêt sur http://${host}:${port} — node ${process.version}, dist=${DIST_DIR}` +
        (files.length ? `, env: ${files.join(', ')}` : ', env: variables du processus'),
    );
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
// Sous Phusion Passenger, le module est chargé en tant qu'entrée : on démarre aussi.
const invokedDirectly =
  process.argv[1] === fileURLToPath(import.meta.url) || process.env.MEDINFO_AUTOSTART === '1';

if (invokedDirectly) {
  start();
}
