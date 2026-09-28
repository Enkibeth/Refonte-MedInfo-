/**
 * Point d'entrée CommonJS pour les hébergeurs qui exigent un fichier de démarrage `.js`
 * (hPanel Hostinger « Node.js app » / Phusion Passenger, cPanel, Plesk…).
 *
 * Le serveur réel est `server/index.mjs` (ESM). Sur un VPS ou en local, on peut l'appeler
 * directement : `node server/index.mjs` — ou `npm start`.
 */
'use strict';

import('./server/index.mjs')
  .then((mod) => mod.start())
  .catch((error) => {
    console.error('[medinfo] démarrage impossible :', error);
    process.exit(1);
  });
