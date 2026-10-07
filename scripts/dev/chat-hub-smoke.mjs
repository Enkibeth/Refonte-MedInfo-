/**
 * Fumigation navigateur du chat comme point d'entrée des modules (ADR-0044) — HORS CI, opt-in.
 *
 * Rejoue dans Chromium, pour CHAQUE état de compte (étudiant, professionnel, grand public,
 * visiteur), ce qu'aucun test unitaire ne voit : le câblage entre l'écran du chat et les
 * outils, et le fait que chacun ne voit que ce qui lui revient.
 * Étudiant :
 *   A. relevé de notes choisi dans le chat → jamais envoyé à /api/chat → analysé par Partiels ;
 *   B. Partiels → « Construire mon plan avec le chat » → chat pré-rempli SANS identifiant ;
 *   C. commande « /ecos cardiologie » → ECOS filtré, sans appel au modèle ;
 *   D. carte d'action d'une réponse → outil Scores sur le bon score, marqueur jamais affiché ;
 *   E. « En faire une présentation » → générateur pré-rempli avec la réponse ;
 *   F. glisser-déposer d'un relevé et relevé collé → même tri ;
 *   G. évaluation ECOS → « Retravailler avec le chat ».
 * Professionnel : relevé de notes refusé sans Partiels, PDF ordinaire joint, commandes et
 * cartes limitées à ses outils (jamais ECOS ni Partiels), puces CALC vers Scores, passerelle
 * présentation sans ECOS/Révisions.
 * Grand public : pas de pièce jointe ni de dépôt, seule la commande /document, seule la carte
 * Document, aucune passerelle. Visiteur : aucune commande, aucune carte.
 *
 * Aucun appel réel : Supabase et /api/chat sont simulés DANS le navigateur ; le serveur local
 * tourne sans aucune clé.
 *
 * Prérequis (Playwright n'est pas une dépendance du dépôt) :
 *   EXPO_PUBLIC_SUPABASE_URL=https://fakeproj.supabase.co EXPO_PUBLIC_SUPABASE_ANON_KEY=fake npm run build
 *   npm i --no-save playwright-core
 *   node scripts/dev/chat-hub-smoke.mjs
 *
 * Variables d'environnement : CHROMIUM_PATH, PLAYWRIGHT_CORE (cf. chat-smoke.mjs) ;
 *   SMOKE_SHOTS=dossier   captures 390 px de chaque compte (contrôle visuel, facultatif).
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
  console.error('Chromium introuvable : définis CHROMIUM_PATH.');
  process.exit(2);
}

// ── Serveur local sans clé ────────────────────────────────────────────────────
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
process.on('exit', () => server.kill());
for (let i = 0; ; i++) {
  try {
    if ((await fetch(`${BASE}/api/health`)).ok) break;
  } catch {
    /* pas encore prêt */
  }
  if (i > 100) throw new Error('le serveur local ne démarre pas');
  await new Promise((r) => setTimeout(r, 100));
}

// ── Session étudiante factice + Supabase simulé ───────────────────────────────
const USER_ID = 'e7e7e7e7-0000-4000-8000-000000000001';
const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 3600;
const user = {
  id: USER_ID, aud: 'authenticated', role: 'authenticated', email: 'etudiant@example.test',
  app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z',
};
const makeSession = (id) => ({
  access_token: `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: id, exp, role: 'authenticated', aud: 'authenticated' })}.sig`,
  token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'refresh-test', user: { ...user, id },
});
const session = makeSession(USER_ID);
// Compte admin : identifiant lu dans src/admin/index.ts (session locale FACTICE, aucun accès réel).
const ADMIN_ID = fs.readFileSync(path.join(REPO, 'src/admin/index.ts'), 'utf8').match(/'([0-9a-f-]{36})'/)[1];
const SHOTS = process.env.SMOKE_SHOTS || null;
const ecosData = JSON.parse(fs.readFileSync(path.join(REPO, 'data/ecos-cases.json'), 'utf8'));
const ECOS_CASES = ecosData.cases.map((c, i) => ({ id: `0e0e0e0e-0000-4000-8000-${String(i).padStart(12, '0')}`, ...c }));
const ATTEMPT = {
  id: 'a7a7a7a7-0000-4000-8000-000000000001',
  case_slug: ECOS_CASES[0].slug,
  case_title: ECOS_CASES[0].title,
  specialty: ECOS_CASES[0].specialty,
  score: 11.5,
  evaluation: '**Note : 11,5/20**\n\n- Interrogatoire incomplet : antécédents familiaux non demandés.',
  created_at: '2026-10-01T10:00:00Z',
};
const PROFILES = {
  student: { persona: 'student', verified_personas: ['public', 'student'] },
  professional: { persona: 'professional', verified_personas: ['public', 'professional'] },
  public: { persona: 'public', verified_personas: ['public'] },
  admin: { persona: 'public', verified_personas: ['public'] },
};
let account = 'student';
let currentSession = session;
let conversations = 0;
async function supabaseRoute(route) {
  const req = route.request();
  const url = new URL(req.url());
  const method = req.method();
  const json = (status, body) =>
    route.fulfill({ status, contentType: 'application/json', body: body === undefined ? '' : JSON.stringify(body) });
  if (url.pathname.startsWith('/auth/v1/user')) return json(200, currentSession.user);
  if (url.pathname.startsWith('/auth/v1/token')) return json(200, currentSession);
  if (url.pathname === '/rest/v1/profiles') {
    return json(200, {
      ...PROFILES[account], status: 'verified',
      first_name: null, last_name: null, age: null, sex: null, chat_country: null,
    });
  }
  if (url.pathname === '/rest/v1/chat_conversations' && method === 'POST') {
    return json(201, { id: `c0c0c0c0-0000-4000-8000-${String(++conversations).padStart(12, '0')}` });
  }
  if (url.pathname === '/rest/v1/ecos_cases') return json(200, ECOS_CASES);
  if (url.pathname === '/rest/v1/ecos_attempts') return json(200, method === 'GET' ? [ATTEMPT] : undefined);
  return json(200, method === 'GET' ? [] : undefined);
}

// ── /api/chat simulé ──────────────────────────────────────────────────────────
const sse = (chunks) => chunks.map((c) => `data: ${typeof c === 'string' ? c : JSON.stringify(c)}\n\n`).join('');
const TEXT = (t) => sse([{ type: 'start' }, { type: 'start-step' }, { type: 'text-start', id: 'x' }, { type: 'text-delta', id: 'x', delta: t },
  { type: 'text-end', id: 'x' }, { type: 'finish-step' }, { type: 'finish', finishReason: 'stop' }, '[DONE]']);
// Flux réaliste depuis la PR #169 : résumé de réflexion, recherche web du provider (action
// et pages), sources citées, puis la réponse avec ses marqueurs d'interface.
const RICH = (t) => sse([
  { type: 'start' }, { type: 'start-step' },
  { type: 'reasoning-start', id: 'r1' }, { type: 'reasoning-delta', id: 'r1', delta: '**Choisir le score adapté**\n\nComparer HAS-BLED et ORBIT.' }, { type: 'reasoning-end', id: 'r1' },
  { type: 'tool-input-start', toolCallId: 'ws1', toolName: 'web_search', providerExecuted: true },
  { type: 'tool-input-available', toolCallId: 'ws1', toolName: 'web_search', input: {}, providerExecuted: true },
  { type: 'tool-output-available', toolCallId: 'ws1', providerExecuted: true, output: { action: { type: 'search', query: 'HAS-BLED ESC 2024' }, sources: [{ type: 'url', url: 'https://www.escardio.org/guidelines' }] } },
  { type: 'source-url', sourceId: 's1', url: 'https://www.escardio.org/guidelines', title: 'ESC 2024' },
  { type: 'text-start', id: 'x' }, { type: 'text-delta', id: 'x', delta: t }, { type: 'text-end', id: 'x' },
  { type: 'finish-step' }, { type: 'finish', finishReason: 'stop' }, '[DONE]',
]);
const queue = [];
const requests = [];
// Version annoncée par le « serveur » simulé (en-tête X-MedInfo-Build) : null = la même que
// celle du bundle exécuté (aucun bandeau attendu), sinon une autre empreinte.
let announcedBuild = null;
async function chatRoute(route) {
  requests.push(JSON.parse(route.request().postData() || '{}'));
  const next = queue.shift();
  if (!next) return route.fulfill({ status: 500, body: 'aucune réponse programmée' });
  const headers = { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' };
  if (announcedBuild) headers['x-medinfo-build'] = announcedBuild;
  await route.fulfill({ status: 200, headers, body: next });
}

// Promo synthétique (12 étudiants, mêmes chiffres que partiel-smoke.mjs).
const PROMO = [
  ['Numéro étudiant', 'Anatomie', 'Biochimie', 'Physiologie'],
  ['28710001', '4', '18', '10'], ['28710002', '6', '17', '11'], ['28710003', '6', '16', '12'],
  ['28710004', '7', '16', '9'], ['28710005', '7,5', '15', '13'], ['28710006', '8', '15', '8'],
  ['28710007', '8', '14', '14'], ['28710008', '9', '14', '10'], ['28710009', '10', '13', '11'],
  ['28710010', '11', '12', 'ABS'], ['28710011', '12', '11', '15'], ['28710012', '14', '10', '16'],
].map((r) => r.join(';')).join('\n');

const fails = [];
const ok = (cond, label, extra = '') => {
  console.log(cond ? '  ✓' : '  ✗', label, cond ? '' : extra);
  if (!cond) fails.push(label);
};

const browser = await chromium.launch({ executablePath: CHROMIUM });
const pageErrors = [];

/** Nouvelle page pour un état de compte (session factice, sauf visiteur). */
async function pageFor(kind, viewport = { width: 1280, height: 900 }) {
  account = kind === 'guest' ? 'public' : kind;
  currentSession = kind === 'admin' ? makeSession(ADMIN_ID) : session;
  const mobile = viewport.width < 700;
  const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
  if (kind !== 'guest') {
    await context.addInitScript(([key, value]) => localStorage.setItem(key, value), ['sb-fakeproj-auth-token', JSON.stringify(currentSession)]);
  }
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(`${kind}: ${String(e)}`));
  await page.route(`${SUPA}/**`, supabaseRoute);
  await page.route('**/api/chat', chatRoute);
  await page.route('**/api/chat-meta', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  return page;
}

/** Chat prêt : profil chargé (signal propre à chaque compte). */
async function openChatAs(page, kind) {
  await page.goto(`${BASE}/chat`, { waitUntil: 'networkidle' });
  if (kind === 'student' || kind === 'professional') {
    await page.getByRole('button', { name: 'Joindre un document' }).waitFor({ timeout: 20_000 });
  } else if (kind === 'public') {
    await page.getByText('pour ouvrir un outil sans quitter le chat', { exact: false }).waitFor({ timeout: 20_000 });
  } else {
    await page.getByText('Essai gratuit', { exact: false }).first().waitFor({ timeout: 20_000 });
  }
}

const bodyText = (page) => page.locator('body').textContent();
const sendMessage = async (page, text) => {
  await page.locator('textarea').first().fill(text);
  await page.getByRole('button', { name: 'Envoyer le message' }).click();
};
const dropFile = (page, name, content) =>
  page.evaluate(([n, csv]) => {
    const dt = new DataTransfer();
    dt.items.add(new File([csv], n, { type: 'text/csv' }));
    for (const type of ['dragenter', 'dragover', 'drop']) {
      window.dispatchEvent(new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true }));
    }
  }, [name, content]);

try {
  console.log('\n══ ÉTUDIANT ══');
  const page = await pageFor('student');
  const input = page.locator('textarea').first();
  const openChat = () => openChatAs(page, 'student');
  const frameOf = (suffix) => page.frames().find((f) => f.url().endsWith(suffix));

  console.log('A — relevé de notes joint au chat → outil Partiels');
  await openChat();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Joindre un document' }).click();
  const fc = await chooser;
  ok((await fc.element().getAttribute('accept')).includes('.xlsx'), 'tableurs proposés au sélecteur (outil Partiels ouvert)');
  await fc.setFiles({ name: 'promo-S5.csv', mimeType: 'text/csv', buffer: Buffer.from(PROMO) });
  const gradeCard = page.getByTestId('grade-file-card');
  await gradeCard.waitFor({ timeout: 5_000 });
  ok((await gradeCard.textContent()).includes('n’est pas envoyé à l’IA'), 'carte : le relevé n’est pas joint au message');
  ok(!(await page.getByRole('button', { name: 'Retirer le document' }).isVisible()), 'aucune pièce jointe dans le composeur');
  await page.getByRole('button', { name: 'Analyser dans l’outil Partiels' }).click();
  await page.waitForURL('**/partiel', { timeout: 10_000 });
  await page.waitForFunction(() => [...document.querySelectorAll('iframe')].some((f) => f.src.endsWith('/partiel.html')));
  let partiel;
  for (let i = 0; i < 50 && !partiel; i++) {
    partiel = frameOf('/partiel.html');
    if (!partiel) await page.waitForTimeout(100);
  }
  await partiel.waitForSelector('#bar:not([hidden])', { timeout: 15_000 });
  ok(/12 étudiants/.test(await partiel.textContent('#bfsub')), 'Partiels a reçu et analysé le fichier (12 étudiants)');
  ok(requests.length === 0, 'aucun appel à /api/chat : le relevé n’a jamais quitté le navigateur');

  console.log('B — Partiels → chat pré-rempli');
  await partiel.fill('#idinput', '28710012');
  await partiel.waitForSelector('#btnaskchat', { timeout: 5_000 });
  await partiel.click('#btnaskchat');
  await page.waitForURL('**/chat', { timeout: 10_000 });
  await page.waitForFunction(() => (document.querySelector('textarea')?.value || '').includes('Moyenne'), null, { timeout: 10_000 });
  const briefing = await input.inputValue();
  // 11 classés sur 12 : 28710010 a une absence, la base « notes complètes » l'écarte du rang.
  ok(briefing.includes('Moyenne : 13,33/20 ; rang 1 sur 11'), 'message pré-rempli avec ma moyenne et mon rang', briefing.slice(0, 200));
  ok(!/2871\d{4}/.test(briefing), 'aucun identifiant étudiant dans le message (ni le mien ni ceux des autres)');
  ok(await page.getByText('Message préparé par l’outil Partiels', { exact: false }).isVisible(), 'bandeau : message à relire avant envoi');
  ok(requests.length === 0, 'rien envoyé d’office');

  console.log('C — commande « /ecos cardiologie »');
  await input.fill('/ec');
  await page.getByTestId('slash-menu').waitFor({ timeout: 5_000 });
  ok((await page.getByTestId('slash-menu').textContent()).includes('/ecos'), 'menu « / » : la commande /ecos est proposée');
  await input.fill('/ecos cardiologie');
  await input.press('Enter');
  await page.waitForURL('**/ecos', { timeout: 10_000 });
  const search = page.getByPlaceholder('Rechercher un cas, un thème…');
  await search.waitFor({ timeout: 10_000 });
  await page.waitForFunction(() => [...document.querySelectorAll('input')].some((i) => i.value === 'cardiologie'), null, { timeout: 5_000 }).catch(() => {});
  ok((await search.inputValue()) === 'cardiologie', 'ECOS ouvert et filtré sur la spécialité', await search.inputValue());
  ok(requests.length === 0, 'aucun appel au modèle pour une commande');

  const askWithCard = async () => {
    await openChat();
    queue.push(TEXT('Le score de référence est le CHA₂DS₂-VASc.\n\n<!--OUTIL:scores|CHA2DS2-VASc-->\n'));
    await input.fill('Comment évaluer le risque embolique dans la FA ?');
    await page.getByRole('button', { name: 'Envoyer le message' }).click();
    await page.getByTestId('module-action-card').waitFor({ timeout: 10_000 });
  };

  console.log('D — carte d’action dans une réponse');
  await askWithCard();
  const card = page.getByTestId('module-action-card');
  ok((await card.textContent()).includes('Calculer'), 'carte « Calculer : CHA2DS2-VASc » affichée');
  ok(!(await page.locator('body').textContent()).includes('OUTIL'), 'le marqueur n’est jamais affiché');

  console.log('E — « En faire une présentation »');
  const bridge = page.getByRole('link', { name: 'En faire une présentation' });
  ok(await bridge.isVisible(), 'passerelle visible sous la réponse');
  await bridge.click();
  await page.waitForURL('**/presentation', { timeout: 10_000 });
  let deck;
  let draft = '';
  for (let i = 0; i < 80 && !draft; i++) {
    deck = frameOf('/presentation.html');
    const active = deck ? await deck.$eval('.mip-tab.is-active', (t) => t.textContent).catch(() => '') : '';
    if (active === 'Mode IA') draft = await deck.$eval('.mip-textarea', (t) => t.value).catch(() => '');
    if (!draft) await page.waitForTimeout(100);
  }
  ok(draft.includes('risque embolique') && draft.includes('CHA₂DS₂-VASc'), 'générateur pré-rempli : sujet + synthèse de la réponse', draft.slice(0, 160));
  ok(requests.length === 1, 'aucun appel au modèle de plus (rien généré sans clic)');

  ok(JSON.stringify(requests.at(-1).capabilities) === '["module-actions"]', 'requête : le client déclare savoir afficher les cartes');

  console.log('D ter — onglet resté sur une ancienne version');
  await openChat();
  const served = await fetch(`${BASE}/api/health`).then((r) => r.headers.get('x-medinfo-build'));
  const running = await page.evaluate(() => (document.querySelector('script[src*="/_expo/static/js/web/entry-"]')?.getAttribute('src') || '').match(/entry-([0-9a-f]+)\.js/)?.[1] ?? null);
  ok(!!served && served === running, `le serveur annonce la version qu’il sert (${served})`);
  ok(!(await page.getByTestId('update-banner').isVisible()), 'même version : aucun bandeau');
  announcedBuild = 'deadbeefdeadbeef';
  queue.push(TEXT('Réponse après déploiement.'));
  await sendMessage(page, 'Une autre question');
  await page.getByText('Réponse après déploiement.').waitFor({ timeout: 10_000 });
  await page.getByTestId('update-banner').waitFor({ timeout: 5_000 });
  ok((await page.getByTestId('update-banner').textContent()).includes('Rechargez la page'), 'nouvelle version servie : bandeau « Recharger »');
  announcedBuild = null;

  console.log('D bis — clic sur la carte → outil Scores');
  await askWithCard();
  await page.getByTestId('module-action-card').click();
  await page.waitForURL('**/scores', { timeout: 10_000 });
  await page.getByText('Tous les scores').waitFor({ timeout: 10_000 });
  ok(await page.getByText('CHA₂DS₂-VASc', { exact: false }).first().isVisible(), 'Scores ouvert directement sur CHA₂DS₂-VASc');

  console.log('F — glisser-déposer et relevé collé');
  await openChat();
  await page.evaluate((csv) => {
    const dt = new DataTransfer();
    dt.items.add(new File([csv], 'promo.csv', { type: 'text/csv' }));
    for (const type of ['dragenter', 'dragover', 'drop']) {
      window.dispatchEvent(new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true }));
    }
  }, PROMO);
  await gradeCard.waitFor({ timeout: 5_000 });
  ok(true, 'fichier déposé sur le chat : relevé repéré, carte Partiels');
  await page.getByRole('button', { name: 'Fermer' }).click();
  await input.fill(PROMO);
  await gradeCard.waitFor({ timeout: 5_000 });
  ok((await gradeCard.textContent()).includes('Ce texte ressemble à un relevé de notes'), 'relevé collé : suggestion Partiels');

  console.log('G — évaluation ECOS → « Retravailler avec le chat »');
  await page.goto(`${BASE}/ecos`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: `Voir l’évaluation de ${ATTEMPT.case_title}` }).first().click();
  await page.getByRole('button', { name: 'Retravailler avec le chat' }).click();
  await page.waitForURL('**/chat', { timeout: 10_000 });
  await page.waitForFunction(() => (document.querySelector('textarea')?.value || '').includes('station ECOS'), null, { timeout: 10_000 });
  const debrief = await input.inputValue();
  ok(debrief.includes(ATTEMPT.case_title) && debrief.includes('antécédents familiaux'), 'débriefing pré-rempli (station + évaluation)');

  await page.context().close();

  // ── PROFESSIONNEL ──────────────────────────────────────────────────────────
  console.log('\n══ PROFESSIONNEL ══');
  const pro = await pageFor('professional');
  await openChatAs(pro, 'professional');
  let before = requests.length;
  const proChooser = pro.waitForEvent('filechooser');
  await pro.getByRole('button', { name: 'Joindre un document' }).click();
  const proFc = await proChooser;
  ok(!(await proFc.element().getAttribute('accept')).includes('.xlsx'), 'pas de tableur au sélecteur (pas d’outil Partiels)');
  await proFc.setFiles({ name: 'promo.csv', mimeType: 'text/csv', buffer: Buffer.from(PROMO) });
  await pro.getByTestId('grade-file-card').waitFor({ timeout: 5_000 });
  const proCard = await pro.getByTestId('grade-file-card').textContent();
  ok(proCard.includes('Collez seulement') && !proCard.includes('Analyser dans Partiels'), 'relevé refusé, vouvoiement, sans bouton Partiels');
  ok(!(await pro.getByRole('button', { name: 'Retirer le document' }).isVisible()), 'relevé jamais joint');
  await pro.getByRole('button', { name: 'Fermer' }).click();
  const pdfChooser = pro.waitForEvent('filechooser');
  await pro.getByRole('button', { name: 'Joindre un document' }).click();
  await (await pdfChooser).setFiles({ name: 'Resultats_S5.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF') });
  await pro.getByRole('button', { name: 'Retirer le document' }).waitFor({ timeout: 5_000 });
  ok(true, 'PDF au nom évocateur : joint normalement (pas de Partiels pour ce compte)');
  await pro.getByRole('button', { name: 'Retirer le document' }).click();
  await pro.locator('textarea').first().fill('/');
  const proMenu = await pro.getByTestId('slash-menu').textContent();
  ok(proMenu.includes('/score') && proMenu.includes('/audio') && proMenu.includes('/présentation'), 'menu « / » : ses outils (score, présentation, audio…)');
  ok(!proMenu.includes('/ecos') && !proMenu.includes('/partiels') && !proMenu.includes('/révisions'), 'menu « / » : jamais ECOS, Partiels ni Révisions');
  queue.push(TEXT('Réponse ordinaire.'));
  await sendMessage(pro, '/ecos cardiologie');
  await pro.getByText('Réponse ordinaire.').waitFor({ timeout: 10_000 });
  ok(requests.length === before + 1 && pro.url().endsWith('/chat'), '« /ecos » n’est pas une commande pour un pro : simple message');
  // ECOS : hors du rôle ; HAS-BLED : déjà ouvert par la puce CALC (doublon retiré) ;
  // CHA₂DS₂-VASc : seule carte attendue.
  queue.push(TEXT('Score adapté.\n\n<!--OUTIL:ecos|Cardiologie-->\n<!--OUTIL:scores|HAS-BLED-->\n<!--OUTIL:scores|CHA2DS2-VASc-->\n<!--CALC:hasbled,grace-->\n'));
  await sendMessage(pro, 'Risque hémorragique sous AVK ?');
  await pro.getByTestId('module-action-card').first().waitFor({ timeout: 10_000 });
  const proText = await bodyText(pro);
  const proCards = await pro.getByTestId('module-action-card').allTextContents();
  // \s couvre l'espace insécable de « Calculer : … ».
  ok(proCards.length === 1 && /Calculer\sCHA2DS2-VASc/.test(proCards[0].replace(/\s:\s/, ' ')), 'une seule carte : ECOS filtré, HAS-BLED dédoublonné avec la puce CALC', JSON.stringify(proCards));
  ok(await pro.getByRole('link', { name: 'Calculer HAS-BLED dans l’outil Scores' }).isVisible(), 'CALC : HAS-BLED ouvre le calculateur');
  ok(proText.includes('À calculer avec le chat') && proText.includes('GRACE'), 'CALC : GRACE (hors catalogue) reste « avec le chat »');
  ok(await pro.getByRole('link', { name: 'En faire une présentation' }).isVisible(), 'passerelle présentation visible');
  ok(!(await pro.getByRole('link', { name: 'S’entraîner sur un cas ECOS' }).isVisible()), 'aucune passerelle ECOS');
  ok(!proText.includes('OUTIL') && !proText.includes('<!--'), 'aucun marqueur affiché');
  await dropFile(pro, 'promo.csv', PROMO);
  await pro.getByTestId('grade-file-card').waitFor({ timeout: 5_000 });
  ok(true, 'dépôt d’un relevé : même refus');
  await pro.context().close();

  // ── GRAND PUBLIC ───────────────────────────────────────────────────────────
  console.log('\n══ GRAND PUBLIC ══');
  const pub = await pageFor('public');
  await openChatAs(pub, 'public');
  let pubText = await bodyText(pub);
  ok(pubText.includes('tapez') && pubText.includes('/document'), 'astuce au vouvoiement, avec /document seulement');
  ok(!(await pub.getByRole('button', { name: 'Joindre un document' }).isVisible()), 'pas de pièce jointe');
  await pub.locator('textarea').first().fill('/');
  const pubMenu = await pub.getByTestId('slash-menu').textContent();
  ok(pubMenu.includes('/document') && !pubMenu.includes('/score') && !pubMenu.includes('/ecos'), 'menu « / » : /document seulement');
  await pub.locator('textarea').first().fill('');
  await dropFile(pub, 'promo.csv', PROMO);
  await pub.waitForTimeout(400);
  ok(!(await pub.getByTestId('grade-file-card').isVisible()) && !(await pub.getByTestId('chat-drop-overlay').isVisible()), 'dépôt de fichier sans effet');
  await pub.locator('textarea').first().fill(PROMO);
  await pub.waitForTimeout(300);
  ok(!(await pub.getByTestId('grade-file-card').isVisible()), 'texte collé : pas de suggestion Partiels');
  queue.push(TEXT('Votre compte rendu peut être expliqué.\n\n<!--OUTIL:document-->\n<!--OUTIL:ecos|Cardio-->\n'));
  await sendMessage(pub, 'Que veut dire mon compte rendu d’IRM ?');
  await pub.getByTestId('module-action-card').first().waitFor({ timeout: 10_000 });
  pubText = await bodyText(pub);
  ok((await pub.getByTestId('module-action-card').count()) === 1 && pubText.includes('Analyser un document'), 'carte Document seule');
  ok(!(await pub.getByRole('link', { name: 'En faire une présentation' }).isVisible()), 'aucune passerelle');
  await pub.getByTestId('module-action-card').click();
  await pub.waitForURL('**/document', { timeout: 10_000 });
  ok(true, 'carte Document → outil Analyse de document');
  await pub.context().close();

  // ── VISITEUR ───────────────────────────────────────────────────────────────
  console.log('\n══ VISITEUR ══');
  const guest = await pageFor('guest');
  await openChatAs(guest, 'guest');
  ok(!(await bodyText(guest)).includes('pour ouvrir un outil'), 'aucune astuce « / »');
  await guest.locator('textarea').first().fill('/');
  await guest.waitForTimeout(300);
  ok(!(await guest.getByTestId('slash-menu').isVisible()), 'aucun menu « / »');
  before = requests.length;
  queue.push(TEXT('Réponse.\n\n<!--OUTIL:document-->\n'));
  await sendMessage(guest, 'Bonjour, une question santé');
  await guest.getByText('Réponse.', { exact: true }).waitFor({ timeout: 10_000 });
  ok(requests.length === before + 1 && (await guest.getByTestId('module-action-card').count()) === 0, 'carte jamais affichée à un visiteur');
  await guest.context().close();

  // ── ADMIN ───────────────────────────────────────────────────────────────────
  console.log('\n══ ADMIN ══');
  const admin = await pageFor('admin');
  await openChatAs(admin, 'student');
  await admin.locator('textarea').first().fill('/');
  const adminItems = await admin.getByRole('menuitem').count();
  ok(adminItems === 9, `menu « / » : les 9 outils (${adminItems})`);
  await admin.context().close();

  // ── FLUX RÉEL (PR #169) + PRO SUR LE CHAT ÉTUDIANT ─────────────────────────
  console.log('\n══ FLUX RÉALISTE (PR #169) ══');
  const rich = await pageFor('professional');
  await openChatAs(rich, 'professional');
  await rich.getByRole('tab', { name: 'Étudiant' }).click().catch(() => rich.getByText('Étudiant', { exact: true }).first().click());
  queue.push(RICH('Le HAS-BLED reste la référence (SRC1).\n\n<!--OUTIL:scores|HAS-BLED-->\n<!--OUTIL:ecos|Cardiologie-->\n\nSOURCES\nSRC1 :: [GUIDELINE] ESC :: ESC :: Fibrillation atriale :: 2024\nhttps://www.escardio.org/guidelines\n'));
  await sendMessage(rich, 'Quel score de risque hémorragique ?');
  await rich.getByTestId('module-action-card').first().waitFor({ timeout: 10_000 });
  const richText = await bodyText(rich);
  ok(/Étapes/.test(richText), 'déroulé « Étapes » de la PR #169 présent avec les cartes');
  ok((await rich.getByTestId('module-action-card').count()) === 1, 'pro sur le chat étudiant : toujours SES outils (carte ECOS filtrée)');
  ok(!richText.includes('OUTIL') && !richText.includes('<!--'), 'aucun marqueur, ni dans la réponse ni dans le déroulé');
  ok(!(await rich.getByRole('link', { name: 'S’entraîner sur un cas ECOS' }).isVisible()), 'chat étudiant ouvert par un pro : pas de passerelle ECOS');
  ok(await rich.getByRole('link', { name: 'En faire une présentation' }).isVisible(), 'passerelle présentation présente');
  ok(requests.at(-1).chatbot === 'student', 'requête : chatbot étudiant');
  await rich.context().close();

  // ── CAPTURES MOBILES (facultatif) ──────────────────────────────────────────
  if (SHOTS) {
    fs.mkdirSync(SHOTS, { recursive: true });
    for (const kind of ['student', 'professional', 'public']) {
      const m = await pageFor(kind, { width: 390, height: 844 });
      await openChatAs(m, kind);
      await m.screenshot({ path: path.join(SHOTS, `${kind}-vide.png`) });
      await m.locator('textarea').first().fill('/');
      await m.waitForTimeout(200);
      await m.screenshot({ path: path.join(SHOTS, `${kind}-commandes.png`) });
      await m.locator('textarea').first().fill('');
      queue.push(RICH('Réponse simulée.\n\n<!--OUTIL:scores|HAS-BLED-->\n<!--OUTIL:document-->\n<!--OUTIL:ecos|Cardiologie-->\n'));
      await sendMessage(m, 'Question de démonstration');
      await m.getByText('Réponse simulée.').waitFor({ timeout: 10_000 });
      await m.waitForTimeout(300);
      await m.screenshot({ path: path.join(SHOTS, `${kind}-cartes.png`) });
      await m.context().close();
    }
    console.log(`  (captures dans ${SHOTS})`);
  }

  ok(pageErrors.length === 0, `aucune erreur JavaScript${pageErrors.length ? ` : ${pageErrors.join(' | ')}` : ''}`);
} finally {
  await browser.close();
  server.kill();
}

if (fails.length) {
  console.error(`\n${fails.length} échec(s) : ${fails.join(' | ')}`);
  process.exit(1);
}
console.log('\nParcours chat ↔ outils OK');
