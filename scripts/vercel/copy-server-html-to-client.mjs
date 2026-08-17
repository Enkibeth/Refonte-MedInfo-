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
  // Refonte SEO 2026-07 : toutes les pages publiques indexables ont leur coquille
  // statique (marketing, tarifs, outils, légal) — les crawlers reçoivent le HTML
  // pré-rendu avec <SeoHead> même si la fonction serveur est contournée.
  { from: '(marketing)/a-propos.html', to: 'a-propos/index.html' },
  { from: '(marketing)/contact.html', to: 'contact/index.html' },
  { from: '(billing)/pricing.html', to: 'pricing/index.html' },
  { from: '(chat)/document.html', to: 'document/index.html' },
  { from: '(chat)/ecos.html', to: 'ecos/index.html' },
  { from: '(chat)/revision.html', to: 'revision/index.html' },
  { from: '(chat)/partiel.html', to: 'partiel/index.html' },
  { from: '(chat)/audio.html', to: 'audio/index.html' },
  { from: '(chat)/presentation.html', to: 'presentation/index.html' },
  { from: '(chat)/cv-builder.html', to: 'cv-builder/index.html' },
  { from: '(chat)/article.html', to: 'article/index.html' },
  { from: '(legal)/mentions-legales.html', to: 'mentions-legales/index.html' },
  { from: '(legal)/cgu.html', to: 'cgu/index.html' },
  { from: '(legal)/confidentialite.html', to: 'confidentialite/index.html' },
  { from: '(legal)/legal.html', to: 'legal/index.html' },
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
