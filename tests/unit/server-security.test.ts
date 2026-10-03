/**
 * En-têtes de sécurité, CSP à empreintes et service des coquilles HTML du serveur Node
 * (server/lib/security.mjs, server/lib/html.mjs). La fumigation `npm run smoke:node` vérifie
 * le même contrat sur le vrai serveur et un vrai build.
 */
import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { analyzeManifest, matchHtmlRoute } from '../../server/lib/html.mjs';
import {
  BASE_SECURITY_HEADERS,
  buildCsp,
  cspHeaderName,
  cspModeFrom,
  extraConnectOrigins,
  inlineScriptHashes,
} from '../../server/lib/security.mjs';

const sha = (text: string) => `'sha256-${crypto.createHash('sha256').update(text, 'utf8').digest('base64')}'`;

describe('en-têtes de sécurité communs', () => {
  it('posent anti-reniflage, référent, anti-clickjacking, permissions et isolation', () => {
    expect(BASE_SECURITY_HEADERS).toMatchObject({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'SAMEORIGIN',
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    });
  });

  it('gardent le micro (dictée) et le plein écran (chat) pour le site lui-même, coupent la caméra et la géolocalisation', () => {
    const policy = BASE_SECURITY_HEADERS['Permissions-Policy'];
    expect(policy).toContain('microphone=(self)');
    expect(policy).toContain('fullscreen=(self)');
    expect(policy).toContain('camera=()');
    expect(policy).toContain('geolocation=()');
  });
});

describe('inlineScriptHashes', () => {
  it('hache le texte exact des scripts inline exécutables', () => {
    const body = 'globalThis.__EXPO_ROUTER_HYDRATE__=true;';
    expect(inlineScriptHashes(`<head><script type="module">${body}</script></head>`)).toEqual([sha(body)]);
    expect(inlineScriptHashes(`<script>\n  var a = 1;\n</script>`)).toEqual([sha('\n  var a = 1;\n')]);
  });

  it('ignore les scripts externes (couverts par self) et les blocs de données (JSON-LD)', () => {
    const html =
      '<script src="/_expo/static/js/web/entry.js" defer></script>' +
      '<script data-rh="true" type="application/ld+json">{"@type":"Organization"}</script>' +
      "<script type='text/javascript'>run()</script>";
    expect(inlineScriptHashes(html)).toEqual([sha('run()')]);
  });

  it('dédoublonne et ignore les scripts vides', () => {
    expect(inlineScriptHashes('<script>x()</script><script></script><script>x()</script>')).toEqual([sha('x()')]);
  });
});

describe('buildCsp', () => {
  const csp = buildCsp({ scriptHashes: ["'sha256-abc'"], connectExtra: ['https://db.example.org'] });
  const directive = (name: string) => csp.split('; ').find((d) => d.startsWith(`${name} `)) ?? '';

  it('n’autorise que les scripts de même origine et ceux dont l’empreinte est connue', () => {
    expect(directive('script-src')).toBe("script-src 'self' 'sha256-abc'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(directive('script-src')).not.toContain("'unsafe-inline'");
  });

  it('interdit l’encadrement par un autre site, les plugins et la réécriture de <base>', () => {
    expect(directive('frame-ancestors')).toBe("frame-ancestors 'self'");
    expect(directive('object-src')).toBe("object-src 'none'");
    expect(directive('base-uri')).toBe("base-uri 'self'");
  });

  it('ouvre les connexions aux seuls services appelés depuis le navigateur', () => {
    const connect = directive('connect-src');
    for (const origin of ['https://*.supabase.co', 'wss://*.supabase.co', 'https://api.crossref.org', 'https://www.ebi.ac.uk', 'https://db.example.org']) {
      expect(connect).toContain(origin);
    }
    expect(connect).not.toMatch(/(^| )https:( |$)/);
  });
});

describe('interrupteur CSP', () => {
  it('appliquée par défaut, coupable ou en observation par variable d’environnement', () => {
    expect(cspModeFrom({})).toBe('enforce');
    expect(cspModeFrom({ CSP: 'report-only' })).toBe('report-only');
    expect(cspModeFrom({ CSP: 'OFF' })).toBe('off');
    expect(cspHeaderName('enforce')).toBe('Content-Security-Policy');
    expect(cspHeaderName('report-only')).toBe('Content-Security-Policy-Report-Only');
    expect(cspHeaderName('off')).toBeNull();
  });

  it('ajoute un domaine Supabase personnalisé, jamais un *.supabase.co déjà couvert ni du http', () => {
    expect(extraConnectOrigins('https://api.medinfo-ai.com')).toEqual(['https://api.medinfo-ai.com', 'wss://api.medinfo-ai.com']);
    expect(extraConnectOrigins('https://abcd.supabase.co')).toEqual([]);
    expect(extraConnectOrigins('http://localhost:54321')).toEqual([]);
    expect(extraConnectOrigins(undefined)).toEqual([]);
  });
});

const MANIFEST = {
  htmlRoutes: [
    { page: '/index', namedRegex: '^/(?:/)?$' },
    { page: '/(chat)/chat', namedRegex: '^/chat(?:/)?$' },
    { page: '/(marketing)/blog/[slug]', namedRegex: '^/blog/(?<slug>[^/]+?)(?:/)?$' },
  ],
  apiRoutes: [{ page: '/api/chat', namedRegex: '^/api/chat(?:/)?$' }, { page: '/sitemap.xml', namedRegex: '^/sitemap\\.xml(?:/)?$' }],
  notFoundRoutes: [{ page: '/+not-found', namedRegex: '^(?:/(?<notfound>.+?))?(?:/)?$' }],
  redirects: [],
  rewrites: [],
};

describe('analyzeManifest / matchHtmlRoute', () => {
  const routes = analyzeManifest(MANIFEST);
  if (!routes.supported) throw new Error('manifeste de test non pris en charge');

  it('résout pages, routes API et page 404 dans l’ordre du moteur Expo', () => {
    expect(matchHtmlRoute(routes, '/')).toEqual({ kind: 'page', page: '/index', status: 200 });
    expect(matchHtmlRoute(routes, '/chat')).toEqual({ kind: 'page', page: '/(chat)/chat', status: 200 });
    expect(matchHtmlRoute(routes, '/blog/un-article')).toEqual({ kind: 'page', page: '/(marketing)/blog/[slug]', status: 200 });
    expect(matchHtmlRoute(routes, '/sitemap.xml')).toEqual({ kind: 'api' });
    expect(matchHtmlRoute(routes, '/nulle-part')).toEqual({ kind: 'page', page: '/+not-found', status: 404 });
  });

  it('rend la main au moteur Expo dès qu’une fonction non reproduite apparaît', () => {
    expect(analyzeManifest(null).supported).toBe(false);
    expect(analyzeManifest({ ...MANIFEST, rendering: { mode: 'ssr', file: 'x' } }).supported).toBe(false);
    expect(analyzeManifest({ ...MANIFEST, middleware: { file: 'm.js' } }).supported).toBe(false);
    expect(analyzeManifest({ ...MANIFEST, redirects: [{ source: '/a', destination: '/b' }] }).supported).toBe(false);
    expect(
      analyzeManifest({ ...MANIFEST, htmlRoutes: [{ page: '/x', namedRegex: '^/x$', loader: 'l.js' }] }).supported,
    ).toBe(false);
  });
});
