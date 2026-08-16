/**
 * Configuration PM2 pour un VPS Hostinger (Ubuntu + Node 22).
 *
 * Usage :
 *   pm2 start ecosystem.config.cjs --env production
 *   pm2 save && pm2 startup      # redémarrage automatique après reboot
 *   pm2 logs medinfo-ai
 *
 * Avec le déploiement git de hPanel (« Node.js app »), ce fichier ne sert pas : le panneau
 * démarre lui-même le fichier d'entrée `server.js`. Voir docs/09_DEPLOYMENT.md.
 */
module.exports = {
  apps: [
    {
      name: 'medinfo-ai',
      script: 'server/index.mjs',
      // Un seul processus : les caches de configuration des features IA (60 s) sont par
      // processus, donc un cluster multiplierait les appels de config sans gain réel tant
      // que le trafic tient sur un cœur. Augmenter `instances` seulement après mesure —
      // et après avoir vérifié que `SUPABASE_SERVICE_ROLE_KEY` est bien posée (sans elle,
      // le rate-limit retombe sur un compteur mémoire, faussé en multi-instances).
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
