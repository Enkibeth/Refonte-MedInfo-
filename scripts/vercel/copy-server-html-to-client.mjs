#!/usr/bin/env node
/**
 * Fallback statique Vercel pour les exports Expo Router en mode `web.output=server`.
 *
 * `expo export -p web` génère les coquilles HTML pré-rendues dans `dist/server` et les
 * assets client dans `dist/client`. L'adaptateur Expo/Vercel sert normalement le HTML via
 * la fonction serveur, mais Vercel renvoie un `404: NOT_FOUND` plateforme à la racine `/`
 * quand le déploiement est traité comme une sortie statique et que `dist/client/index.html`
 * est absent.
 *
 * Ce script copie les coquilles HTML déterministes vers des chemins propres dans
 * `dist/client` après l'export. Les routes API restent servies par `api/index.js`.
 */
import { copyFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROUTES = [
  { from: 'index.html', to: 'index.html' },
  { from: '(chat)/chat.html', to: 'chat/index.html' },
  { from: '(auth)/sign-in.html', to: 'sign-in/index.html' },
  { from: '(account)/account.html', to: 'account/index.html' },
  { from: '+not-found.html', to: '404.html' },
];

const serverDir = path.join(process.cwd(), 'dist/server');
const clientDir = path.join(process.cwd(), 'dist/client');

if (!existsSync(serverDir)) {
  throw new Error('Missing dist/server. Run `expo export -p web` before copying HTML fallbacks.');
}

if (!existsSync(clientDir)) {
  throw new Error('Missing dist/client. Run `expo export -p web` before copying HTML fallbacks.');
}

for (const route of ROUTES) {
  const source = path.join(serverDir, route.from);
  const target = path.join(clientDir, route.to);
  if (!existsSync(source)) continue;

  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(source, target);
  console.log(`[vercel:fallback] copied ${route.from} -> dist/client/${route.to}`);
}
