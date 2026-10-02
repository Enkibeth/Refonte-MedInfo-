/**
 * Captures VISUELLES de l'application (contrôle de design local) — accueil, pages publiques ET
 * écrans connectés, sans compte, sans base et sans appel métier.
 *
 * Session simulée : le build doit viser un Supabase factice, que ce script intercepte —
 *   EXPO_PUBLIC_SUPABASE_URL=https://mock.supabase.co EXPO_PUBLIC_SUPABASE_ANON_KEY=mock npm run build
 *   node scripts/design/capture-ui.mjs [sortie] [écran,écran…]
 * Le profil renvoyé est un étudiant vérifié (rôles public + étudiant + pro) ; toute autre
 * lecture REST renvoie une liste vide. Aucune requête ne quitte la machine (le reste du réseau
 * externe est coupé). Ni recette fonctionnelle, ni validation de production : seulement la
 * composition des écrans et l'état de leurs contrôles (repos, survol, focus clavier).
 *
 * Playwright est fourni par l'environnement de travail (MEDINFO_PLAYWRIGHT_DIR, sinon le
 * module global), il n'est PAS une dépendance de l'application.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createServer } from '../../server/index.mjs';

const require = createRequire(import.meta.url);
function loadPlaywright() {
  const candidates = [process.env.MEDINFO_PLAYWRIGHT_DIR, 'playwright', '/opt/node22/lib/node_modules/playwright'];
  for (const candidate of candidates.filter(Boolean)) {
    try {
      return require(candidate);
    } catch {
      /* candidat suivant */
    }
  }
  throw new Error('Playwright introuvable : définir MEDINFO_PLAYWRIGHT_DIR.');
}
const { chromium } = loadPlaywright();

const MOCK = 'https://mock.supabase.co';
const PORT = 4175;
const output = path.resolve(process.argv[2] ?? 'captures');
const only = process.argv[3]?.split(',').filter(Boolean) ?? null;
await fs.mkdir(output, { recursive: true });

/** Écrans capturés : chemin + session (connecté ou visiteur). */
const SCREENS = [
  { name: 'accueil', path: '/', session: false },
  { name: 'connexion', path: '/sign-in', session: false },
  { name: 'tarifs', path: '/pricing', session: false },
  { name: 'contact', path: '/contact', session: false },
  { name: 'chat-invite', path: '/chat', session: false },
  { name: 'dashboard', path: '/dashboard', session: true },
  { name: 'chat', path: '/chat', session: true },
  { name: 'ecos', path: '/ecos', session: true },
  { name: 'scores', path: '/scores', session: true },
  { name: 'revision', path: '/revision', session: true },
  { name: 'document', path: '/document', session: true },
  { name: 'audio', path: '/audio', session: true },
  { name: 'compte', path: '/account', session: true },
  { name: 'role', path: '/choose-role', session: true },
  { name: 'cv', path: '/cv-builder', session: true },
  { name: 'presentation', path: '/presentation', session: true },
].filter((screen) => !only || only.includes(screen.name));

const USER = {
  id: '00000000-0000-4000-8000-000000000001',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'etudiant@example.com',
  email_confirmed_at: '2026-01-01T00:00:00Z',
  app_metadata: { provider: 'email' },
  user_metadata: {},
  created_at: '2026-01-01T00:00:00Z',
};
const PROFILE = {
  persona: 'student',
  status: 'verified',
  verified_personas: ['public', 'student', 'pro'],
  first_name: 'Camille',
  last_name: 'Martin',
  age: 24,
  sex: null,
  chat_country: 'FR',
};

// Données d'affichage : conversations factices et les cas ECOS FICTIFS du dépôt (data/).
const now = Date.now();
const CONVERSATIONS = [
  ['Critères de Horton', 'Rhumatologie', 1],
  ['Hyponatrémie : mécanismes', 'Néphrologie', 5],
  ['Fièvre prolongée inexpliquée', 'Infectiologie', 30],
  ['Score CHA2DS2-VASc', 'Cardiologie', 60 * 30],
].map(([title, category, minutesAgo], index) => ({
  id: `00000000-0000-4000-8000-00000000010${index}`,
  chatbot: 'student',
  title,
  category,
  created_at: new Date(now - minutesAgo * 60_000).toISOString(),
  updated_at: new Date(now - minutesAgo * 60_000).toISOString(),
}));
const ecosData = JSON.parse(await fs.readFile(path.resolve('data/ecos-cases.json'), 'utf8'));
const ECOS_CASES = (Array.isArray(ecosData) ? ecosData : ecosData.cases)
  .slice(0, 6)
  .map((entry, index) => ({ id: `00000000-0000-4000-8000-00000000020${index}`, ...entry }));
const FIXTURES = { chat_conversations: CONVERSATIONS, ecos_cases: ECOS_CASES };

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}
function fakeSession() {
  const exp = Math.floor(Date.now() / 1000) + 24 * 3600;
  const accessToken = `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url({ sub: USER.id, exp, role: 'authenticated', aud: 'authenticated' })}.signature`;
  return { access_token: accessToken, token_type: 'bearer', expires_in: 24 * 3600, expires_at: exp, refresh_token: 'mock-refresh', user: USER };
}

process.env.ACCESS_LOG = 'off';
const server = createServer();
await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });

async function routeMock(context) {
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1') return route.continue();
    if (url.origin !== MOCK) return route.abort();
    const wantsObject = (route.request().headers().accept ?? '').includes('vnd.pgrst.object');
    if (url.pathname.startsWith('/rest/v1/profiles')) {
      return route.fulfill({ json: wantsObject ? PROFILE : [PROFILE] });
    }
    const table = url.pathname.replace('/rest/v1/', '');
    if (route.request().method() === 'GET' && FIXTURES[table]) return route.fulfill({ json: FIXTURES[table] });
    if (url.pathname.startsWith('/rest/v1/')) return route.fulfill({ json: wantsObject ? {} : [] });
    if (url.pathname === '/auth/v1/user') return route.fulfill({ json: USER });
    if (url.pathname.startsWith('/auth/v1/token')) return route.fulfill({ json: fakeSession() });
    return route.fulfill({ json: {} });
  });
}

const report = [];
try {
  for (const width of [390, 1440]) {
    for (const screen of SCREENS) {
      // Mobile = écran tactile (pointer: coarse) : les contrôles compacts y prennent 44 px.
      const mobile = width < 700;
      const context = await browser.newContext({
        viewport: { width, height: mobile ? 844 : 900 },
        reducedMotion: 'reduce',
        hasTouch: mobile,
        isMobile: mobile,
      });
      await routeMock(context);
      if (screen.session) {
        const session = fakeSession();
        await context.addInitScript((value) => {
          window.localStorage.setItem('sb-mock-auth-token', value);
          window.localStorage.setItem('medinfo.shell.hadSession', '1');
        }, JSON.stringify(session));
      }
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${PORT}${screen.path}`, { waitUntil: 'networkidle' }).catch(() => {});
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(600);
      const file = path.join(output, `${screen.name}-${width}.png`);
      await page.screenshot({ path: file });
      // Contrôles visibles sans nom accessible ni texte : à corriger (lecteur d'écran muet).
      const unnamed = await page.evaluate(() =>
        [...document.querySelectorAll('[role="button"],button,[role="link"],a')]
          .filter((node) => {
            const rect = node.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return false;
            const name = (node.getAttribute('aria-label') ?? '') + (node.textContent ?? '');
            return name.trim() === '';
          })
          .map((node) => node.outerHTML.slice(0, 120)),
      );
      // Cibles tactiles < 44 px sur mobile (05_DESIGN §5).
      const small = width < 700
        ? await page.evaluate(() =>
            [...document.querySelectorAll('[role="button"],button,[role="tab"],[role="checkbox"],[role="radio"],[role="switch"]')]
              .map((node) => ({ node, rect: node.getBoundingClientRect() }))
              .filter(({ rect }) => rect.width > 0 && rect.height > 0 && (rect.height < 43.5 || rect.width < 43.5))
              .map(({ node, rect }) => `${Math.round(rect.width)}×${Math.round(rect.height)} ${(node.getAttribute('aria-label') || node.textContent || '').trim().slice(0, 40)}`),
          )
        : [];
      report.push({ screen: screen.name, width, url: page.url(), errors, unnamed, small });
      await context.close();
    }
  }
} finally {
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
  server.closeAllConnections?.();
  await new Promise((resolve) => server.close(resolve));
}
for (const entry of report) {
  console.log(`${entry.screen}@${entry.width} → ${entry.url.replace(`http://127.0.0.1:${PORT}`, '')} | erreurs ${entry.errors.length} | sans nom ${entry.unnamed.length} | < 44 px ${entry.small.length}`);
}
