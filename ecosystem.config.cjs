/**
 * Configuration PM2 pour un VPS Hostinger (Ubuntu + Node 22).
 *
 * Usage :
 *   pm2 start ecosystem.config.cjs --env production
 *   pm2 save && pm2 startup      # redémarrage automatique après reboot
 *   pm2 logs medinfo-ai
 *
 * En hébergement mutualisé hPanel (« Node.js app » / Passenger), ce fichier ne sert pas :
 * le panneau démarre lui-même `server.js`. Voir docs/09_DEPLOYMENT_HOSTINGER.md.
 */
module.exports = {
  apps: [
    {
      name: 'medinfo-ai',
      script: 'server/index.mjs',
      // Un seul processus : l'application n'a aucun état en mémoire partagé, mais le
      // rate-limit et les caches de config (featureModel, 60 s) sont par processus —
      // passer en cluster multiplierait les appels de configuration sans gain réel tant
      // que le trafic tient sur un cœur. Augmenter `instances` seulement après mesure.
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      // Une réponse de chat « complexe » peut durer plusieurs minutes : laisser le temps
      // aux requêtes en vol de se terminer (et à `onFinish` d'archiver) avant le SIGKILL.
      kill_timeout: 30000,
      max_memory_restart: '900M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '127.0.0.1',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '127.0.0.1',
      },
    },
  ],
};
