/**
 * Fumigation navigateur du chat — HORS CI, opt-in (2026-10).
 *
 * Rejoue dans Chromium (vue mobile) le parcours signalé par Hugo : compte Pro vérifié, mode
 * Approfondi, image jointe, réponse VIDE (réflexion qui épuise le plafond de sortie). Avant
 * le correctif, l'écran restait muet et un « Réessayer » ou un « ? » ne transmettait plus que
 * le nom du fichier. Vérifie aussi la reprise d'un flux coupé et le tour suivant sans document.
 * Les tests unitaires couvrent la logique pure ; ce script couvre le câblage dans l'écran
 * (useChat, bandeau, composeur), qu'aucun test unitaire ne voit.
 *
 * Aucun appel réel : Supabase (auth, profil, historique) et /api/chat sont simulés DANS le
 * navigateur ; le serveur local tourne avec un environnement VIDÉ de toute clé.
 *
 * Prérequis (Playwright n'est pas une dépendance du dépôt) :
 *   EXPO_PUBLIC_SUPABASE_URL=https://fakeproj.supabase.co EXPO_PUBLIC_SUPABASE_ANON_KEY=fake npm run build
 *   npm i --no-save playwright-core
 *   node scripts/dev/chat-smoke.mjs
 *
 * Le script refuse de tourner sur un build qui pointe vers un vrai projet Supabase.
 *
 * Variables d'environnement :
 *   CHROMIUM_PATH   chemin du binaire Chromium (sinon : chemins usuels sondés)
 *   PLAYWRIGHT_CORE spécifieur d'import de playwright-core (défaut : 'playwright-core')
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_CORE || 'playwright-core');

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SUPA_HOST = 'fakeproj.supabase.co';
const SUPA = `https://${SUPA_HOST}`;

// ── Garde : le bundle doit pointer vers le Supabase factice ─────────────────────
const jsDir = path.join(REPO, 'dist/client/_expo/static/js/web');
const bundles = fs.existsSync(jsDir) ? fs.readdirSync(jsDir).filter((f) => f.endsWith('.js')) : [];
if (!bundles.some((f) => fs.readFileSync(path.join(jsDir, f), 'utf8').includes(SUPA_HOST))) {
  console.error(
    `Build absent ou construit pour un vrai projet Supabase. Reconstruire d'abord :\n` +
      `  EXPO_PUBLIC_SUPABASE_URL=${SUPA} EXPO_PUBLIC_SUPABASE_ANON_KEY=fake npm run build`,
  );
  process.exit(2);
}

const CHROMIUM = process.env.CHROMIUM_PATH || [
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
].find((c) => fs.existsSync(c));
if (!CHROMIUM) {
  console.error('Chromium introuvable — définis CHROMIUM_PATH.');
  process.exit(2);
}

// ── Serveur local, environnement minimal (aucune clé) ──────────────────────────
const port = await new Promise((resolve) => {
  const probe = net.createServer().listen(0, '127.0.0.1', () => {
    const { port: free } = probe.address();
    probe.close(() => resolve(free));
  });
});
const BASE = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['server/index.mjs'], {
  cwd: REPO,
  env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: 'production', PORT: String(port), HOST: '127.0.0.1', ACCESS_LOG: 'off' },
  stdio: 'ignore',
});
const stopServer = () => server.kill();
process.on('exit', stopServer);
for (let i = 0; ; i++) {
  try {
    if ((await fetch(`${BASE}/api/health`)).ok) break;
  } catch {
    /* pas encore prêt */
  }
  if (i > 100) throw new Error('le serveur local ne démarre pas');
  await new Promise((r) => setTimeout(r, 100));
}

// ── Session Pro factice ────────────────────────────────────────────────────────
const USER_ID = 'b0b0b0b0-0000-4000-8000-000000000001';
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 3600;
const user = {
  id: USER_ID, aud: 'authenticated', role: 'authenticated', email: 'pro@example.test',
  app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z',
};
const session = {
  access_token: `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: USER_ID, exp, role: 'authenticated', aud: 'authenticated' })}.sig`,
  token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'refresh-test', user,
};

// ── Supabase simulé (auth, profil vérifié Pro, historique en mémoire) ──────────
let conversations = 0;
let clock = Date.now();
const store = new Map();
async function supabaseRoute(route) {
  const req = route.request();
  const url = new URL(req.url());
  const method = req.method();
  const json = (status, body) =>
    route.fulfill({ status, contentType: 'application/json', body: body === undefined ? '' : JSON.stringify(body) });
  if (url.pathname.startsWith('/auth/v1/user')) return json(200, user);
  if (url.pathname.startsWith('/auth/v1/token')) return json(200, session);
  if (url.pathname === '/rest/v1/profiles') {
    return json(200, {
      persona: 'professional', status: 'verified', verified_personas: ['public', 'professional'],
      first_name: null, last_name: null, age: null, sex: null, chat_country: null,
    });
  }
  if (url.pathname === '/rest/v1/chat_conversations') {
    if (method === 'POST') {
      const id = `c0c0c0c0-0000-4000-8000-${String(++conversations).padStart(12, '0')}`;
      store.set(id, []);
      return json(201, { id });
    }
    return method === 'GET' ? json(200, []) : json(204);
  }
  if (url.pathname === '/rest/v1/chat_messages') {
    if (method === 'POST') {
      const rows = [JSON.parse(req.postData() || '{}')].flat();
      for (const r of rows) {
        store.get(r.conversation_id)?.push({ id: `m${++clock}`, role: r.role, content: r.content, created_at: new Date(clock).toISOString() });
      }
      return json(201);
    }
    if (method === 'GET') return json(200, store.get((url.searchParams.get('conversation_id') || '').replace(/^eq\./, '')) ?? []);
    return json(204);
  }
  return json(200, method === 'GET' ? [] : undefined);
}

// ── /api/chat simulé : flux UI programmés, requêtes enregistrées ────────────────
const sse = (chunks) => chunks.map((c) => `data: ${typeof c === 'string' ? c : JSON.stringify(c)}\n\n`).join('');
const EMPTY = sse([{ type: 'start' }, { type: 'start-step' }, { type: 'reasoning-start', id: 'rs_1' }, { type: 'reasoning-end', id: 'rs_1' },
  { type: 'finish-step' }, { type: 'finish', finishReason: 'length' }, '[DONE]']);
const TEXT = (t) => sse([{ type: 'start' }, { type: 'start-step' }, { type: 'text-start', id: 'x' }, { type: 'text-delta', id: 'x', delta: t },
  { type: 'text-end', id: 'x' }, { type: 'finish-step' }, { type: 'finish', finishReason: 'stop' }, '[DONE]']);
const INTERRUPTED = sse([{ type: 'start' }, { type: 'start-step' }, { type: 'reasoning-start', id: 'rs_2' }]);
const queue = [];
const requests = [];
async function chatRoute(route) {
  const body = JSON.parse(route.request().postData() || '{}');
  requests.push(body);
  const next = queue.shift();
  if (!next) return route.fulfill({ status: 500, body: 'aucune réponse programmée' });
  // Flux coupé : le serveur, lui, a fini et archivé la réponse.
  if (next.archive) store.get(body.conversationId)?.push({ id: `m${++clock}`, role: 'assistant', content: next.archive, created_at: new Date(clock).toISOString() });
  await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' }, body: next.body });
}

// ── Parcours ───────────────────────────────────────────────────────────────────
const fails = [];
const ok = (cond, label) => {
  console.log(cond ? '  ✓' : '  ✗', label);
  if (!cond) fails.push(label);
};
const lastUserText = (body) =>
  ((body.messages || []).filter((m) => m.role === 'user').at(-1)?.parts || [])
    .filter((p) => p.type === 'text').map((p) => p.text).join('');

const browser = await chromium.launch({ executablePath: CHROMIUM });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.addInitScript(([key, value]) => {
    localStorage.setItem(key, value);
    localStorage.setItem('medinfo:chatResponseMode', 'deep');
  }, ['sb-fakeproj-auth-token', JSON.stringify(session)]);
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  await page.route(`${SUPA}/**`, supabaseRoute);
  await page.route('**/api/chat', chatRoute);
  await page.route('**/api/chat-meta', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));

  const banner = page.getByText('La réponse n’a pas pu être rédigée', { exact: false });
  const retry = page.getByRole('button', { name: 'Réessayer la dernière question' });
  const removeDoc = page.getByRole('button', { name: 'Retirer le document' });
  const openChat = async () => {
    await page.goto(`${BASE}/chat`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Joindre un document' }).waitFor({ timeout: 20_000 });
  };
  const attachImage = async () => {
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Joindre un document' }).click();
    await (await chooser).setFiles({ name: 'IMG_0847.png', mimeType: 'image/png', buffer: Buffer.from(PNG_B64, 'base64') });
    await removeDoc.waitFor({ timeout: 5_000 });
  };
  const send = async (text) => {
    await page.locator('textarea').first().fill(text);
    await page.getByRole('button', { name: 'Envoyer le message' }).click();
  };

  console.log('A — image + Approfondi → réponse vide → Réessayer');
  await openChat();
  await attachImage();
  queue.push({ body: EMPTY });
  await send('Ton avis ? À faire relire par un ortho ?');
  await banner.waitFor({ timeout: 10_000 });
  let r = requests.at(-1);
  ok(r.chatbot === 'professional' && r.responseMode === 'deep', 'requête : chatbot Pro, mode Approfondi');
  ok(r.attachment?.name === 'IMG_0847.png' && r.attachment?.dataBase64 === PNG_B64, 'premier envoi : image transmise');
  ok((await banner.textContent()).includes('votre document'), 'réponse vide → bandeau, document annoncé');
  ok(await removeDoc.isVisible(), 'le document revient dans le composeur');
  queue.push({ body: TEXT('Analyse de la radiographie : réponse simulée A.') });
  await retry.click();
  await page.getByText('Analyse de la radiographie : réponse simulée A.').waitFor({ timeout: 10_000 });
  r = requests.at(-1);
  ok(r.trigger === 'regenerate-message' && r.regenerate === true, 'Réessayer = régénération du même tour');
  ok(r.attachment?.dataBase64 === PNG_B64, 'Réessayer renvoie l’image, pas seulement son nom');
  ok(!(await banner.isVisible()) && !(await removeDoc.isVisible()), 'réponse arrivée : bandeau et document retirés');
  queue.push({ body: TEXT('Suite sans document.') });
  await send('Et ensuite ?');
  await page.getByText('Suite sans document.').waitFor({ timeout: 10_000 });
  ok(requests.at(-1).attachment === undefined, 'tour suivant : aucun document renvoyé');

  console.log('B — réponse vide puis « ? » tapé');
  await openChat();
  await attachImage();
  queue.push({ body: EMPTY });
  await send('Question B');
  await banner.waitFor({ timeout: 10_000 });
  queue.push({ body: TEXT('Réponse simulée B.') });
  await send('?');
  await page.getByText('Réponse simulée B.').waitFor({ timeout: 10_000 });
  r = requests.at(-1);
  ok(r.attachment?.dataBase64 === PNG_B64, '« ? » renvoie l’image');
  ok(lastUserText(r) === '?\n\nPièce jointe : IMG_0847.png', 'le message mentionne la pièce jointe renvoyée');

  console.log('C — flux coupé sans un mot');
  await openChat();
  queue.push({ body: INTERRUPTED, archive: 'Réponse archivée par le serveur (C).' });
  await send('Question C');
  await page.getByText('Réponse archivée par le serveur (C).').waitFor({ timeout: 15_000 });
  ok(!(await banner.isVisible()), 'réponse reprise depuis l’historique, sans bandeau d’échec');

  console.log('D — réponse vide sans document');
  await openChat();
  queue.push({ body: EMPTY });
  await send('Question D');
  await banner.waitFor({ timeout: 10_000 });
  const textD = await banner.textContent();
  ok(textD.includes('votre question sera renvoyée') && !textD.includes('document'), 'bandeau sans mention de document');

  ok(pageErrors.length === 0, `aucune erreur JavaScript${pageErrors.length ? ` : ${pageErrors.join(' | ')}` : ''}`);
} finally {
  await browser.close();
  stopServer();
}

if (fails.length) {
  console.error(`\n${fails.length} échec(s)`);
  process.exit(1);
}
console.log('\nParcours du chat OK');
