/**
 * Modules purs du serveur Node autonome (migration Hostinger).
 *
 * Ils décident ce que l'ancienne plateforme décidait à notre place : quels chemins sont servis
 * statiquement, avec quels en-têtes de cache, dans quel encodage, et comment lire les
 * en-têtes du reverse proxy. Une régression ici est invisible en développement (tout
 * fonctionne quand même) mais coûteuse en production : fuite de fichier hors `dist/client`,
 * bundle mis en cache pour un an alors qu'il ne devrait pas, ou URL publique en `http://`
 * dans un lien de paiement.
 *
 * Le chemin d'I/O complet est couvert par `npm run smoke:node` (nécessite un build).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { applyEnv, parseDotEnv } from '../../server/lib/env.mjs';
import {
  checkSupabaseKeys,
  describeKey,
  describeKeyShape,
  expectedProjectRef,
} from '../../server/lib/keycheck.mjs';
import {
  CLIENT_IP_HEADERS,
  canonicalHostFrom,
  canonicalRedirect,
  parseTrustedHops,
  resolveClientIp,
  resolveForwarded,
  resolveListenTarget,
  withRawHeader,
  withoutRawHeaders,
} from '../../server/lib/proxy.mjs';
import {
  ASSET_CACHE_CONTROL,
  IMMUTABLE_CACHE_CONTROL,
  NO_STORE_CACHE_CONTROL,
  cacheControlFor,
  contentTypeFor,
  etagFor,
  isCompressible,
  isNotModified,
  pickEncoding,
  resolveStaticPath,
} from '../../server/lib/static.mjs';

const ROOT = path.resolve('/srv/medinfo/dist/client');

describe('cacheControlFor', () => {
  it('rend les bundles hachés immuables', () => {
    expect(cacheControlFor('/_expo/static/js/web/entry-abc123.js')).toBe(IMMUTABLE_CACHE_CONTROL);
  });

  it('met les assets versionnés en cache court avec revalidation', () => {
    expect(cacheControlFor('/assets/assets/icon.png')).toBe(ASSET_CACHE_CONTROL);
    expect(cacheControlFor('/vendor/js/pdf.min.js')).toBe(ASSET_CACHE_CONTROL);
  });

  it("n'autorise aucun cache pour les coquilles HTML et les pages autonomes", () => {
    expect(cacheControlFor('/partiel.html')).toBe(NO_STORE_CACHE_CONTROL);
    expect(cacheControlFor('/robots.txt')).toBe(NO_STORE_CACHE_CONTROL);
  });

  it('ne se laisse pas berner par un préfixe partiel', () => {
    expect(cacheControlFor('/_expo/staticx/evil.js')).toBe(NO_STORE_CACHE_CONTROL);
    expect(cacheControlFor('/assetsx/evil.js')).toBe(NO_STORE_CACHE_CONTROL);
  });
});

describe('resolveStaticPath', () => {
  it('résout un fichier de dist/client', () => {
    expect(resolveStaticPath(ROOT, '/partiel.html')).toBe(path.join(ROOT, 'partiel.html'));
    expect(resolveStaticPath(ROOT, '/_expo/static/js/web/a.js')).toBe(
      path.join(ROOT, '_expo/static/js/web/a.js'),
    );
  });

  it('décode les caractères échappés du nom de fichier', () => {
    expect(resolveStaticPath(ROOT, '/assets/mon%20fichier.png')).toBe(
      path.join(ROOT, 'assets/mon fichier.png'),
    );
  });

  it('confine toute traversée de répertoire, encodée ou non, sous dist/client', () => {
    // Le `..` est normalisé AVANT résolution : le chemin obtenu reste toujours sous la
    // racine (il n'existe simplement pas sur le disque et la requête part vers Expo).
    // C'est la garantie qui compte : jamais un fichier du dépôt (package.json, .env)
    // ni du système ne peut être servi.
    for (const attempt of [
      '/../package.json',
      '/%2e%2e/package.json',
      '/assets/../../../etc/passwd',
      '/assets/%2e%2e%2f%2e%2e%2fpackage.json',
      '/....//package.json',
    ]) {
      const resolved = resolveStaticPath(ROOT, attempt);
      if (resolved === null) continue;
      expect(resolved.startsWith(ROOT + path.sep)).toBe(true);
      expect(resolved).not.toBe(path.resolve(ROOT, '..', 'package.json'));
    }
  });

  it('refuse les URL mal encodées et les octets nuls', () => {
    expect(resolveStaticPath(ROOT, '/%E0%A4%A.js')).toBeNull();
    expect(resolveStaticPath(ROOT, '/assets/a%00.png')).toBeNull();
  });

  it('laisse les routes de rendu au moteur Expo (pas de fichier, pas de répertoire)', () => {
    expect(resolveStaticPath(ROOT, '/')).toBeNull();
    expect(resolveStaticPath(ROOT, '/chat')).toBeNull();
    expect(resolveStaticPath(ROOT, '/blog/mon-article')).toBeNull();
    expect(resolveStaticPath(ROOT, '/assets/')).toBeNull();
  });

  it("ne laisse jamais un fichier masquer une route API", () => {
    expect(resolveStaticPath(ROOT, '/api/health')).toBeNull();
    expect(resolveStaticPath(ROOT, '/api/chat.js')).toBeNull();
  });

  it('rejette une entrée qui ne commence pas par /', () => {
    expect(resolveStaticPath(ROOT, 'partiel.html')).toBeNull();
    expect(resolveStaticPath(ROOT, '')).toBeNull();
  });
});

describe('contentTypeFor / isCompressible', () => {
  it('type les fichiers de l’export web', () => {
    expect(contentTypeFor('/x/a.js')).toBe('text/javascript; charset=utf-8');
    expect(contentTypeFor('/x/a.html')).toBe('text/html; charset=utf-8');
    expect(contentTypeFor('/x/a.woff2')).toBe('font/woff2');
    expect(contentTypeFor('/x/a.inconnu')).toBe('application/octet-stream');
  });

  it('ne compresse que ce qui gagne à l’être', () => {
    expect(isCompressible('/x/a.js')).toBe(true);
    expect(isCompressible('/x/a.svg')).toBe(true);
    expect(isCompressible('/x/a.png')).toBe(false);
    expect(isCompressible('/x/a.woff2')).toBe(false);
  });
});

describe('pickEncoding', () => {
  it('préfère brotli quand les deux variantes existent', () => {
    expect(pickEncoding('gzip, deflate, br', { br: true, gzip: true })).toEqual({
      encoding: 'br',
      suffix: '.br',
    });
  });

  it('retombe sur gzip si brotli est absent du disque', () => {
    expect(pickEncoding('gzip, br', { gzip: true })).toEqual({ encoding: 'gzip', suffix: '.gz' });
  });

  it('respecte un q=0 explicite', () => {
    expect(pickEncoding('br;q=0, gzip;q=1', { br: true, gzip: true })).toEqual({
      encoding: 'gzip',
      suffix: '.gz',
    });
  });

  it('sert en clair quand rien n’est accepté ou disponible', () => {
    expect(pickEncoding('identity', { br: true, gzip: true }).encoding).toBeNull();
    expect(pickEncoding(undefined, { br: true }).encoding).toBeNull();
    expect(pickEncoding('gzip, br', {}).encoding).toBeNull();
  });

  it('accepte le joker *', () => {
    expect(pickEncoding('*', { gzip: true }).encoding).toBe('gzip');
  });
});

describe('etagFor / isNotModified', () => {
  const entity = { size: 1234, mtimeMs: 1_700_000_000_500 };
  const etag = etagFor(entity);

  it('produit un ETag faible stable', () => {
    expect(etag).toMatch(/^W\/"[0-9a-f]+-[0-9a-f]+"$/);
    expect(etagFor(entity)).toBe(etag);
    expect(etagFor({ ...entity, size: 1235 })).not.toBe(etag);
  });

  it('reconnaît le même ETag, fort ou faible, et le joker', () => {
    expect(isNotModified({ ifNoneMatch: etag }, { etag, mtimeMs: entity.mtimeMs })).toBe(true);
    expect(
      isNotModified({ ifNoneMatch: etag.replace('W/', '') }, { etag, mtimeMs: entity.mtimeMs }),
    ).toBe(true);
    expect(isNotModified({ ifNoneMatch: '*' }, { etag, mtimeMs: entity.mtimeMs })).toBe(true);
    expect(isNotModified({ ifNoneMatch: 'W/"autre"' }, { etag, mtimeMs: entity.mtimeMs })).toBe(
      false,
    );
  });

  it('ignore If-Modified-Since dès qu’un If-None-Match est fourni (RFC 9110)', () => {
    const future = new Date(entity.mtimeMs + 60_000).toUTCString();
    expect(
      isNotModified(
        { ifNoneMatch: 'W/"autre"', ifModifiedSince: future },
        { etag, mtimeMs: entity.mtimeMs },
      ),
    ).toBe(false);
  });

  it('compare If-Modified-Since à la seconde près', () => {
    // Le fichier a été modifié à .500 ms : un en-tête à la même seconde vaut « inchangé ».
    const sameSecond = new Date(Math.floor(entity.mtimeMs / 1000) * 1000).toUTCString();
    expect(isNotModified({ ifModifiedSince: sameSecond }, { etag, mtimeMs: entity.mtimeMs })).toBe(
      true,
    );
    const before = new Date(entity.mtimeMs - 10_000).toUTCString();
    expect(isNotModified({ ifModifiedSince: before }, { etag, mtimeMs: entity.mtimeMs })).toBe(
      false,
    );
    expect(isNotModified({ ifModifiedSince: 'pas une date' }, { etag, mtimeMs: entity.mtimeMs })).toBe(
      false,
    );
  });

  it('sans en-tête conditionnel, sert le contenu', () => {
    expect(isNotModified({}, { etag, mtimeMs: entity.mtimeMs })).toBe(false);
  });
});

describe('resolveForwarded', () => {
  it('rend https derrière un proxy qui termine le TLS', () => {
    expect(
      resolveForwarded(
        { host: 'interne:3000', 'x-forwarded-proto': 'https', 'x-forwarded-host': 'medinfo.fr' },
        { trustProxy: true },
      ),
    ).toEqual({ protocol: 'https', host: 'medinfo.fr' });
  });

  it('ne garde que le premier maillon d’une chaîne de proxies', () => {
    expect(
      resolveForwarded({ host: 'a', 'x-forwarded-proto': 'https, http' }, { trustProxy: true })
        .protocol,
    ).toBe('https');
  });

  it('gère la variante X-Forwarded-Ssl', () => {
    expect(resolveForwarded({ host: 'a', 'x-forwarded-ssl': 'on' }, { trustProxy: true })).toEqual({
      protocol: 'https',
      host: 'a',
    });
  });

  it('ignore les en-têtes falsifiables quand le proxy n’est pas de confiance', () => {
    expect(
      resolveForwarded(
        { host: 'reel', 'x-forwarded-proto': 'https', 'x-forwarded-host': 'attaquant.example' },
        { trustProxy: false },
      ),
    ).toEqual({ protocol: 'http', host: 'reel' });
  });

  it('retombe sur la connexion réelle sans en-tête de proxy', () => {
    expect(resolveForwarded({ host: 'a' }, { trustProxy: true, encrypted: true }).protocol).toBe(
      'https',
    );
    expect(resolveForwarded({}, { trustProxy: true }).host).toBeUndefined();
  });
});

describe('resolveClientIp', () => {
  it('lit l’entrée ajoutée par NOTRE proxy (à droite), jamais celle fournie par le client', () => {
    // Le client a glissé une fausse adresse en tête ; le proxy a ajouté la vraie à droite.
    expect(
      resolveClientIp({ 'x-forwarded-for': '198.51.100.7, 203.0.113.9' }, { remoteAddress: '127.0.0.1' }),
    ).toBe('203.0.113.9');
  });

  it('remonte d’autant de maillons que de proxys de confiance (CDN + serveur web)', () => {
    expect(
      resolveClientIp(
        { 'x-forwarded-for': '198.51.100.7, 203.0.113.9, 192.0.2.44' },
        { hops: 2, remoteAddress: '127.0.0.1' },
      ),
    ).toBe('203.0.113.9');
  });

  it('retombe sur l’entrée la plus à gauche si la liste est plus courte que prévu', () => {
    expect(resolveClientIp({ 'x-forwarded-for': '203.0.113.9' }, { hops: 3 })).toBe('203.0.113.9');
  });

  it('utilise X-Real-IP puis la connexion TCP quand aucune liste n’est fournie', () => {
    expect(resolveClientIp({ 'x-real-ip': '203.0.113.9' }, { remoteAddress: '127.0.0.1' })).toBe(
      '203.0.113.9',
    );
    expect(resolveClientIp({}, { remoteAddress: '::ffff:127.0.0.1' })).toBe('127.0.0.1');
  });

  it('ignore tout en-tête de proxy quand le proxy n’est pas de confiance', () => {
    expect(
      resolveClientIp(
        { 'x-forwarded-for': '203.0.113.9', 'x-real-ip': '203.0.113.9' },
        { trustProxy: false, remoteAddress: '192.0.2.1' },
      ),
    ).toBe('192.0.2.1');
  });

  it('nettoie ports, crochets et adresses IPv4 mappées ; écarte ce qui n’est pas une IP', () => {
    expect(resolveClientIp({ 'x-forwarded-for': '203.0.113.9:51234' })).toBe('203.0.113.9');
    expect(resolveClientIp({ 'x-forwarded-for': '[2001:db8::1]:443' })).toBe('2001:db8::1');
    expect(resolveClientIp({ 'x-forwarded-for': 'pas une ip' }, { remoteAddress: '192.0.2.1' })).toBe(
      '192.0.2.1',
    );
  });
});

describe('parseTrustedHops', () => {
  it('vaut 1 par défaut ou pour une valeur invalide, et reste borné', () => {
    expect(parseTrustedHops(undefined)).toBe(1);
    expect(parseTrustedHops('')).toBe(1);
    expect(parseTrustedHops('0')).toBe(1);
    expect(parseTrustedHops('abc')).toBe(1);
    expect(parseTrustedHops('2')).toBe(2);
    expect(parseTrustedHops('99')).toBe(5);
  });
});

describe('withRawHeader', () => {
  it('remplace toutes les occurrences, quelle que soit la casse, sans muter l’original', () => {
    const raw = ['Host', 'a', 'X-Forwarded-For', '1.1.1.1', 'x-forwarded-for', '2.2.2.2'];
    const out = withRawHeader(raw, 'x-forwarded-for', '203.0.113.9');
    expect(out).toEqual(['Host', 'a', 'x-forwarded-for', '203.0.113.9']);
    expect(raw).toHaveLength(6);
  });

  it('retire tous les en-têtes d’adresse client lus par le rate-limit', () => {
    const raw = ['Host', 'a', 'CF-Connecting-IP', '6.6.6.6', 'X-Real-IP', '7.7.7.7', 'Accept', '*/*'];
    expect(withoutRawHeaders(raw, CLIENT_IP_HEADERS)).toEqual(['Host', 'a', 'Accept', '*/*']);
  });

  it('ajoute l’en-tête s’il était absent', () => {
    expect(withRawHeader(['Host', 'a'], 'x-real-ip', '203.0.113.9')).toEqual([
      'Host',
      'a',
      'x-real-ip',
      '203.0.113.9',
    ]);
  });
});

describe('canonicalHostFrom / canonicalRedirect', () => {
  it('dérive l’hôte canonique de CANONICAL_HOST, sinon de EXPO_PUBLIC_APP_URL', () => {
    expect(canonicalHostFrom({ CANONICAL_HOST: 'MedInfo-AI.com' })).toBe('medinfo-ai.com');
    expect(canonicalHostFrom({ EXPO_PUBLIC_APP_URL: 'https://medinfo-ai.com/' })).toBe('medinfo-ai.com');
    expect(canonicalHostFrom({ EXPO_PUBLIC_APP_URL: 'pas une url' })).toBeUndefined();
    expect(canonicalHostFrom({})).toBeUndefined();
  });

  it('redirige www → apex en conservant chemin et query', () => {
    expect(
      canonicalRedirect({
        host: 'www.medinfo-ai.com',
        url: '/blog/x?utm=1',
        canonicalHost: 'medinfo-ai.com',
      }),
    ).toBe('https://medinfo-ai.com/blog/x?utm=1');
  });

  it('redirige apex → www si le canonique est en www', () => {
    expect(
      canonicalRedirect({ host: 'medinfo-ai.com', url: '/', canonicalHost: 'www.medinfo-ai.com' }),
    ).toBe('https://www.medinfo-ai.com/');
  });

  it('ne touche ni au canonique, ni à un autre hôte (domaine de recette Hostinger)', () => {
    expect(
      canonicalRedirect({ host: 'medinfo-ai.com:443', url: '/', canonicalHost: 'medinfo-ai.com' }),
    ).toBeNull();
    expect(
      canonicalRedirect({
        host: 'exemple-123.hostingersite.com',
        url: '/',
        canonicalHost: 'medinfo-ai.com',
      }),
    ).toBeNull();
    expect(canonicalRedirect({ host: 'www.medinfo-ai.com', url: '/', canonicalHost: undefined })).toBeNull();
  });
});

describe('resolveListenTarget', () => {
  it('écoute sur toutes les interfaces (IPv4 + IPv6) quand HOST est absent', () => {
    expect(resolveListenTarget({ PORT: '31337' })).toEqual({ port: 31337 });
    expect(resolveListenTarget({})).toEqual({ port: 3000 });
  });

  it('respecte HOST quand il est posé (VPS derrière nginx)', () => {
    expect(resolveListenTarget({ PORT: '3000', HOST: '127.0.0.1' })).toEqual({
      port: 3000,
      host: '127.0.0.1',
    });
  });

  it('accepte un socket passé dans PORT au lieu d’échouer sur NaN', () => {
    expect(resolveListenTarget({ PORT: '/tmp/app.sock' })).toEqual({ path: '/tmp/app.sock' });
  });

  it('retombe sur 3000 pour un port hors plage', () => {
    expect(resolveListenTarget({ PORT: '70000' })).toEqual({ port: 3000 });
  });
});

describe('parseDotEnv / applyEnv', () => {
  it('lit les formes usuelles d’un fichier .env', () => {
    const parsed = parseDotEnv(
      [
        '# commentaire',
        '',
        'PORT=3000',
        'export HOST=127.0.0.1',
        'QUOTED="ligne1\\nligne2"',
        "SIMPLE='pas #un commentaire'",
        'INLINE=valeur # commentaire de fin',
        'VIDE=',
        'CLE_AVEC_EGAL=sk-abc=def==',
        'pas une ligne valide',
        '=sans_cle',
      ].join('\n'),
    );

    expect(parsed).toEqual({
      PORT: '3000',
      HOST: '127.0.0.1',
      QUOTED: 'ligne1\nligne2',
      SIMPLE: 'pas #un commentaire',
      INLINE: 'valeur',
      VIDE: '',
      CLE_AVEC_EGAL: 'sk-abc=def==',
    });
  });

  it('ne renvoie rien pour une entrée vide ou invalide', () => {
    expect(parseDotEnv('')).toEqual({});
    expect(parseDotEnv(undefined as unknown as string)).toEqual({});
  });

  it("n'écrase JAMAIS une variable déjà posée par l'hébergeur", () => {
    const env: Record<string, string | undefined> = { EXISTANT: 'du-panneau', VIDE: '' };
    const applied = applyEnv({ EXISTANT: 'du-fichier', VIDE: 'du-fichier', NOUVEAU: 'x' }, env);

    expect(env.EXISTANT).toBe('du-panneau');
    expect(env.NOUVEAU).toBe('x');
    // Une variable présente mais vide est traitée comme absente (cas fréquent des panneaux).
    expect(env.VIDE).toBe('du-fichier');
    expect(applied.sort()).toEqual(['NOUVEAU', 'VIDE']);
  });
});

describe('script de build Hostinger', () => {
  const scripts = JSON.parse(readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'))
    .scripts as Record<string, string>;

  it('vide le cache Metro à chaque export (`--clear`)', () => {
    // Constaté chez Hostinger le 2026-09-26 : le cache Metro survit d'un build à l'autre
    // et ressert les modules transformés avec les ANCIENNES valeurs `EXPO_PUBLIC_*` —
    // variables corrigées dans hPanel, bundle client inchangé à l'octet près. Reproduit en
    // local : sans `--clear`, une nouvelle valeur n'apparaît pas dans le bundle.
    expect(scripts.build).toMatch(/\bexpo export\b[^&]*\s--clear\b/);
  });

  it('pré-compresse après l’export, et `build:web` reste un alias de `build`', () => {
    expect(scripts.build).toMatch(/&& node scripts\/hostinger\/precompress\.mjs$/);
    expect(scripts['build:web']).toBe('npm run build');
  });
});

describe('diagnostic des clés Supabase (keycheck)', () => {
  const b64url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const SIGNATURE = 'c2lnbmF0dXJlLXNlY3JldGUtZGUtdGVzdA';
  const jwt = (payload: object) => `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.${SIGNATURE}`;
  const REF = 'sbpnjswffrqxgnglnjml';
  const SERVICE_JWT = jwt({ iss: 'supabase', ref: REF, role: 'service_role' });

  it('décrit un JWT service_role du bon projet sans jamais le recopier', () => {
    const desc = describeKey(SERVICE_JWT);
    expect(desc).toMatchObject({ present: true, format: 'jwt', role: 'service_role', ref: REF });
    const shape = describeKeyShape(desc, REF);
    expect(shape).toContain('rôle service_role');
    expect(shape).toContain(`projet ${REF}`);
    expect(shape).not.toContain(SIGNATURE);
    expect(shape).not.toContain(SERVICE_JWT);
  });

  it('repère les défauts de copie constatés en recette', () => {
    // Valeur passée entièrement en majuscules (août 2026) : le JWT n'est plus décodable.
    expect(describeKeyShape(describeKey(SERVICE_JWT.toUpperCase()), REF)).toMatch(/jwt illisible.*MAJUSCULES/);
    // Texte masqué copié depuis le tableau de bord.
    const masked = describeKey('sb_secret_AbCd••••••••');
    expect(masked).toMatchObject({ format: 'sb_secret', nonAscii: true });
    expect(describeKeyShape(masked, REF)).toContain('texte masqué');
    expect(describeKey(`${SERVICE_JWT} `).edgeWhitespace).toBe(true);
    expect(describeKey(`${SERVICE_JWT}\n`).edgeWhitespace).toBe(true);
    expect(describeKey(`"${SERVICE_JWT}"`).quoted).toBe(true);
    expect(describeKeyShape(describeKey(jwt({ ref: 'autreprojet', role: 'service_role' })), REF)).toContain(
      'AUTRE projet (autreprojet)',
    );
    expect(describeKey(undefined)).toEqual({ present: false });
    expect(describeKey('')).toEqual({ present: false });
  });

  it('tire le projet attendu de l’URL Supabase', () => {
    expect(expectedProjectRef(`https://${REF}.supabase.co`)).toBe(REF);
    expect(expectedProjectRef('https://exemple.com')).toBeUndefined();
    expect(expectedProjectRef('pas une url')).toBeUndefined();
  });

  const fakeFetch =
    (service: { status: number; body: unknown }, anon = { status: 200, body: {} as unknown }) =>
    async (url: string) => {
      const r = url.includes('/rest/v1/') ? service : anon;
      return { status: r.status, json: async () => r.body } as Response;
    };
  const env = {
    SUPABASE_URL: `https://${REF}.supabase.co`,
    SUPABASE_SERVICE_ROLE_KEY: SERVICE_JWT,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_cle_publique_de_test',
  };

  it('ne fait rien sans URL Supabase', async () => {
    expect(await checkSupabaseKeys({})).toEqual([]);
  });

  it('confirme une clé service_role qui voit des lignes', async () => {
    const lines = await checkSupabaseKeys(env, { fetchImpl: fakeFetch({ status: 200, body: [{ key: 'chat' }] }) as never });
    expect(lines.map((l) => l.level)).toEqual(['log', 'log']);
    expect(lines[0].text).toContain('clé service_role acceptée, droits confirmés');
    expect(lines[1].text).toContain('clé publique acceptée');
  });

  it('interroge Supabase avec les mêmes en-têtes que supabase-js (apikey + Bearer)', async () => {
    // Constaté : une clé service_role JWT envoyée en `apikey` seul est traitée en rôle anon
    // (200, aucune ligne) — sans l'en-tête Authorization, le diagnostic se tromperait.
    const seen: Array<{ url: string; headers: Record<string, string> }> = [];
    await checkSupabaseKeys(env, {
      fetchImpl: (async (url: string, init: { headers: Record<string, string> }) => {
        seen.push({ url, headers: init.headers });
        return { status: 200, json: async () => [{ key: 'chat' }] } as Response;
      }) as never,
    });
    const rest = seen.find((s) => s.url.includes('/rest/v1/'));
    expect(rest?.url.startsWith(`https://${REF}.supabase.co/`)).toBe(true);
    expect(rest?.headers).toEqual({ apikey: SERVICE_JWT, Authorization: `Bearer ${SERVICE_JWT}` });
  });

  it('signale une clé acceptée mais sans droits service_role, et une clé refusée', async () => {
    const sansDroits = await checkSupabaseKeys(env, { fetchImpl: fakeFetch({ status: 200, body: [] }) as never });
    expect(sansDroits[0]).toMatchObject({ level: 'error' });
    expect(sansDroits[0].text).toContain('SANS droits service_role');

    const refusee = await checkSupabaseKeys(env, {
      fetchImpl: fakeFetch({ status: 401, body: { message: 'Invalid API key' } }) as never,
    });
    expect(refusee[0]).toMatchObject({ level: 'error' });
    expect(refusee[0].text).toContain('REFUSÉE (HTTP 401 « Invalid API key »)');
  });

  it('ne lance jamais, même si le réseau échoue', async () => {
    const lines = await checkSupabaseKeys(env, {
      fetchImpl: (async () => {
        throw new TypeError('fetch failed');
      }) as never,
    });
    expect(lines.map((l) => l.level)).toEqual(['warn', 'warn']);
    expect(lines[0].text).toContain('vérification de la clé service_role impossible');
  });

  it('classe INUTILISABLE une clé au texte masqué (la requête ne peut même pas partir)', async () => {
    const lines = await checkSupabaseKeys(
      { ...env, SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_AbCd••••••••' },
      {
        fetchImpl: (async (url: string) => {
          if (url.includes('/rest/v1/')) throw new TypeError('Invalid header value');
          return { status: 200, json: async () => ({}) } as Response;
        }) as never,
      },
    );
    expect(lines[0]).toMatchObject({ level: 'error' });
    expect(lines[0].text).toContain('clé service_role INUTILISABLE');
    expect(lines[0].text).toContain('texte masqué');
  });

  it("n'écrit jamais une clé dans le journal", async () => {
    const all = [
      ...(await checkSupabaseKeys(env, { fetchImpl: fakeFetch({ status: 200, body: [{ key: 'x' }] }) as never })),
      ...(await checkSupabaseKeys(env, { fetchImpl: fakeFetch({ status: 401, body: { message: 'Invalid API key' } }) as never })),
    ];
    for (const { text } of all) {
      expect(text).not.toContain(SERVICE_JWT);
      expect(text).not.toContain(SIGNATURE);
      expect(text).not.toContain(env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
    }
  });
});
