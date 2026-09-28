// Banc local — sert l'export web INCHANGÉ (dist/client) et remplace UNIQUEMENT /api/chat
// par un flux SSE synthétique non médical. Toutes les autres routes /api renvoient 503.
// Jamais déployé, jamais exécuté contre une session de production.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
// Réponses synthétiques partagées avec les tests unitaires (Node ≥ 22.6 : --experimental-strip-types).
const { CHAT_ANSWER_FIXTURES } = await import(new URL('../../../../../tests/unit/helpers/chatAnswerFixtures.ts', import.meta.url).href);

const root = process.argv[2];
const port = Number(process.argv[3] || 4173);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.json': 'application/json', '.ico': 'image/x-icon', '.txt': 'text/plain' };

const LONG = CHAT_ANSWER_FIXTURES.PUBLIC_REAL_FORMAT.replace('À RETENIR', Array.from({ length: 14 }, (_, i) => `Paragraphe de défilement ${i + 1}. Ce texte neutre sert uniquement à vérifier le suivi du fil pendant l'arrivée des fragments, la lecture en remontant et le retour en bas.\n`).join('\n') + '\nÀ RETENIR');
const TEXTS = { ...CHAT_ANSWER_FIXTURES, LONG };

// Pages pré-rendues (dist/server) servies comme le ferait le serveur Expo : chemin sans
// groupes « (xxx) », index, segments dynamiques [param].
const serverDir = path.join(root, '..', 'server');
const staticRoutes = new Map();
const dynamicRoutes = [];
async function indexServerPages(dir) {
  let entries = [];
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== '_expo') await indexServerPages(full); continue; }
    if (!e.name.endsWith('.html')) continue;
    const parts = path.relative(serverDir, full).replace(/\.html$/, '').split(path.sep).filter((seg) => !/^\(.*\)$/.test(seg));
    if (parts[parts.length - 1] === 'index') parts.pop();
    const url = '/' + parts.join('/');
    if (parts.some((seg) => /^\[.*\]$/.test(seg))) {
      dynamicRoutes.push([new RegExp('^' + parts.map((seg) => (/^\[.*\]$/.test(seg) ? '[^/]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).map((seg) => '/' + seg).join('') + '$'), full]);
    } else if (!staticRoutes.has(url) || full.endsWith(path.join('server', 'index.html'))) {
      staticRoutes.set(url, full);
    }
  }
}
await indexServerPages(serverDir);

let scenario = { text: 'STUDENT_REAL_FORMAT', firstDelay: 900, every: 35, size: 12, errorAt: null, reasoning: true };
const log = [];

function sse(req, res) {
  const s = { ...scenario };
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    let parsed = {};
    try { parsed = JSON.parse(body); } catch {}
    const entry = { at: Date.now(), messages: (parsed.messages || []).length, users: (parsed.messages || []).filter((m) => m.role === 'user').length, chatbot: parsed.chatbot, closedAt: null, sentChars: 0, scenario: s.text };
    log.push(entry);
    res.writeHead(200, { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1', 'cache-control': 'no-store' });
    const timers = [];
    const send = (d) => res.write('data: ' + JSON.stringify(d) + '\n\n');
    send({ type: 'start', messageId: 'bench-' + log.length });
    if (s.reasoning) {
      timers.push(setTimeout(() => send({ type: 'reasoning-start', id: 'r' }), Math.min(200, s.firstDelay / 3)));
      timers.push(setTimeout(() => send({ type: 'reasoning-end', id: 'r' }), Math.max(250, s.firstDelay - 100)));
    }
    const text = TEXTS[s.text];
    const chunks = text.match(new RegExp(`[\\s\\S]{1,${s.size}}`, 'g')) || [];
    timers.push(setTimeout(() => send({ type: 'text-start', id: 't' }), s.firstDelay));
    chunks.forEach((delta, i) => timers.push(setTimeout(() => {
      if (s.errorAt !== null && entry.sentChars >= s.errorAt * text.length) { entry.closedAt = 'error'; res.destroy(); timers.forEach(clearTimeout); return; }
      entry.sentChars += delta.length;
      send({ type: 'text-delta', id: 't', delta });
    }, s.firstDelay + 50 + i * s.every)));
    timers.push(setTimeout(() => { send({ type: 'text-end', id: 't' }); send({ type: 'finish', finishReason: 'stop' }); res.end('data: [DONE]\n\n'); entry.closedAt = 'finished'; }, s.firstDelay + 100 + chunks.length * s.every));
    res.on('close', () => { timers.forEach(clearTimeout); if (!entry.closedAt) entry.closedAt = 'client-closed'; });
  });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);
  if (pathname === '/__scenario') { scenario = { ...scenario, ...JSON.parse(url.searchParams.get('set') || '{}') }; log.length = 0; res.end(JSON.stringify(scenario)); return; }
  if (pathname === '/__log') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(log)); return; }
  if (pathname === '/__axe.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); res.end(await fs.readFile(path.join(path.dirname(new URL(import.meta.url).pathname), 'node_modules/axe-core/axe.min.js'))); return; }
  if (pathname === '/api/chat' && req.method === 'POST') return sse(req, res);
  if (pathname.startsWith('/api/')) { res.writeHead(503, { 'content-type': 'application/json' }); res.end('{"error":"bench_static_export_no_api"}'); return; }
  let file = path.join(root, pathname);
  const candidates = [file, file + '.html', path.join(file, 'index.html')];
  let found = null;
  for (const c of candidates) { try { if ((await fs.stat(c)).isFile()) { found = c; break; } } catch {} }
  if (!found) found = staticRoutes.get(pathname.replace(/\/+$/, '') || '/') ?? dynamicRoutes.find(([re]) => re.test(pathname))?.[1] ?? null;
  if (!found) { res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' }); res.end(await fs.readFile(path.join(root, '404.html')).catch(() => 'Not found')); return; }
  res.writeHead(200, { 'content-type': mime[path.extname(found)] || 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(await fs.readFile(found));
}).listen(port, () => console.log('bench on', port));
