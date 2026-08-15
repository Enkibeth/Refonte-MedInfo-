/**
 * Modules purs du serveur Node autonome (migration Hostinger).
 *
 * Ils décident ce que Vercel décidait à notre place : quels chemins sont servis
 * statiquement, avec quels en-têtes de cache, dans quel encodage, et comment lire les
 * en-têtes du reverse proxy. Une régression ici est invisible en développement (tout
 * fonctionne quand même) mais coûteuse en production : fuite de fichier hors `dist/client`,
 * bundle mis en cache pour un an alors qu'il ne devrait pas, ou URL publique en `http://`
 * dans un lien de paiement.
 *
 * Le chemin d'I/O complet est couvert par `npm run smoke:node` (nécessite un build).
 */
import { describe, expect, it } from 'vitest';
import path from 'node:path';

import { applyEnv, parseDotEnv } from '../../server/lib/env.mjs';
import { resolveForwarded } from '../../server/lib/proxy.mjs';
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
