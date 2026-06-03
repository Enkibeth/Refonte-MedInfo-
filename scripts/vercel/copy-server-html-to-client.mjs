#!/usr/bin/env node
/**
 * Vercel static fallback for Expo Router server exports.
 *
 * `expo export -p web` with `web.output=server` emits HTML shells in
 * `dist/server` and client assets in `dist/client`. The Expo/Vercel adapter
 * normally serves HTML through the server function, but Vercel can expose a
 * platform `404: NOT_FOUND` at `/` when the deployment/project is treated as a
 * static output and `dist/client/index.html` is absent.
 *
 * This script copies the deterministic, pre-rendered HTML shells to clean paths
 * in `dist/client` after export. API routes remain served by `api/index.js`.
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
