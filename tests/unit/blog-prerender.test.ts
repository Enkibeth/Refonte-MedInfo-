import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';

import {
  articleJsonLd,
  blogSlugFrom,
  createBlogPrerender,
  markdownToHtml,
  publicSiteUrl,
  renderArticleDocument,
  replaceHeadTags,
} from '../../server/lib/blog-prerender.mjs';
import { createHtmlHandler } from '../../server/lib/html.mjs';
import { DEFAULT_SITE_URL, PAGE_SEO, blogPostingJsonLd, pageTitle } from '@/seo/meta';

const SHELL =
  '<!DOCTYPE html><html lang="fr"><head><title data-rh="true">Blog santé | MedInfo AI</title>' +
  '<meta data-rh="true" name="description" content="générique"/><link data-rh="true" rel="canonical" href="https://medinfo-ai.com/blog"/>' +
  '<meta charSet="utf-8"/><script>window.x=1</script></head><body><div id="root"><main>Chargement</main></div></body></html>';

const POST = {
  slug: 'hypertension-reperes',
  title: 'Hypertension : les repères à connaître',
  summary: 'Ce que mesurent les chiffres de tension.',
  category: 'Cardiologie',
  cover_image_url: 'https://cdn.example.org/cover.png',
  content_md: '## Comprendre\n\nUn **chiffre** et un [lien](https://www.has-sante.fr).\n\n- point A\n- point B\n\n<img src=x onerror=alert(1)>',
  published_at: '2026-09-28T06:00:00Z',
  updated_at: '2026-09-29T08:00:00Z',
};

describe('blog pré-rendu serveur : briques pures', () => {
  it('extrait un slug d’article et refuse les chemins ambigus', () => {
    expect(blogSlugFrom('/blog/mon-article')).toBe('mon-article');
    expect(blogSlugFrom('/blog/mon-article/')).toBe('mon-article');
    expect(blogSlugFrom('/blog')).toBeNull();
    expect(blogSlugFrom('/blog/a%2Fb')).toBeNull();
    expect(blogSlugFrom('/blog/%E0%A4%A')).toBeNull();
  });

  it('convertit le markdown sans jamais laisser passer de HTML brut', () => {
    const html = markdownToHtml(POST.content_md);
    expect(html).toContain('<h2>Comprendre</h2>');
    expect(html).toContain('<strong>chiffre</strong>');
    expect(html).toContain('<a href="https://www.has-sante.fr" rel="noopener">lien</a>');
    expect(html).toContain('<ul><li>point A</li><li>point B</li></ul>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    // Le titre de l'article est le seul h1 : un « # » du corps devient un h2.
    expect(markdownToHtml('# Titre')).toBe('<h2>Titre</h2>');
    expect(markdownToHtml('[piège](javascript:alert(1))')).not.toContain('href');
  });

  it('remplace les balises react-helmet sans toucher au reste de la tête', () => {
    const out = replaceHeadTags(SHELL, '<title data-rh="true">Nouveau</title>');
    expect(out).toContain('<title data-rh="true">Nouveau</title>');
    expect(out).not.toContain('générique');
    expect(out).not.toContain('rel="canonical"');
    expect(out).toContain('<meta charSet="utf-8"/>');
    expect(out).toContain('<script>window.x=1</script>');
  });

  it('même fiche BlogPosting que le client (src/seo/meta.ts)', () => {
    expect(articleJsonLd(POST, DEFAULT_SITE_URL)).toEqual(
      blogPostingJsonLd({
        slug: POST.slug,
        title: POST.title,
        summary: POST.summary,
        coverImageUrl: POST.cover_image_url,
        publishedAt: POST.published_at,
        updatedAt: POST.updated_at,
        category: POST.category,
      }),
    );
    const noCover = { ...POST, cover_image_url: null, updated_at: null };
    expect(articleJsonLd(noCover, DEFAULT_SITE_URL)).toEqual(
      blogPostingJsonLd({ slug: POST.slug, title: POST.title, summary: POST.summary, coverImageUrl: null, publishedAt: POST.published_at, category: POST.category }),
    );
  });

  it('dernière modification = la plus récente des deux dates (publication après l’écriture du brouillon)', () => {
    const draftThenPublished = { ...POST, updated_at: '2026-09-28T06:00:10Z', published_at: '2026-09-28T06:04:30Z' };
    const ld = articleJsonLd(draftThenPublished, DEFAULT_SITE_URL) as unknown as { dateModified: string; datePublished: string };
    expect(ld.dateModified).toBe('2026-09-28T06:04:30Z');
    expect(Date.parse(ld.dateModified)).toBeGreaterThanOrEqual(Date.parse(ld.datePublished));
    expect(ld).toEqual(
      blogPostingJsonLd({
        slug: POST.slug, title: POST.title, summary: POST.summary, coverImageUrl: POST.cover_image_url,
        publishedAt: draftThenPublished.published_at, updatedAt: draftThenPublished.updated_at, category: POST.category,
      }),
    );
    const doc = renderArticleDocument(SHELL, draftThenPublished, DEFAULT_SITE_URL);
    expect(doc).toContain('property="article:modified_time" content="2026-09-28T06:04:30Z"');
  });

  it('même titre, même base de site et même titre de blog que le client', () => {
    expect(publicSiteUrl({})).toBe(DEFAULT_SITE_URL);
    expect(publicSiteUrl({ EXPO_PUBLIC_APP_URL: 'https://recette.example.org/' })).toBe('https://recette.example.org');
    const doc = renderArticleDocument(SHELL, POST, DEFAULT_SITE_URL);
    expect(doc).toContain(`<title data-rh="true">${pageTitle(POST.title)}</title>`);
    const source = fs.readFileSync('server/lib/blog-prerender.mjs', 'utf8');
    const description = /const BLOG_DESCRIPTION =\s*((?:\s*(?:"[^"]*"|'[^']*')\s*\+?)+);/.exec(source)?.[1] ?? '';
    const literal = [...description.matchAll(/"([^"]*)"|'([^']*)'/g)].map((m) => m[1] ?? m[2]).join('');
    expect(literal).toBe(PAGE_SEO.blog.description);
  });

  it('document d’article : métadonnées de l’article, texte dans un noscript hors de #root', () => {
    const doc = renderArticleDocument(SHELL, POST, DEFAULT_SITE_URL);
    expect(doc).toContain(`<link data-rh="true" rel="canonical" href="${DEFAULT_SITE_URL}/blog/hypertension-reperes"/>`);
    expect(doc).toContain('property="og:type" content="article"');
    expect(doc).toContain('property="og:image" content="https://cdn.example.org/cover.png"');
    expect(doc).toContain('property="article:modified_time" content="2026-09-29T08:00:00Z"');
    expect(doc).toContain('name="robots" content="index, follow, max-image-preview:large');
    expect(doc).toContain('"@type":"BlogPosting"');
    expect(doc).not.toContain('content="générique"');
    const noscript = doc.indexOf('<noscript>');
    expect(noscript).toBeGreaterThan(doc.indexOf('<body>'));
    expect(noscript).toBeLessThan(doc.indexOf('<div id="root">'));
    expect(doc).toContain('<h1>Hypertension : les repères à connaître</h1>');
    expect(doc).toContain('<time datetime="2026-09-28T06:00:00Z">Publié le 28 septembre 2026</time>');
  });
});

function fakeFetch(rows: unknown[] | Error) {
  return vi.fn(async (_url: string, _init?: RequestInit) => {
    if (rows instanceof Error) throw rows;
    return new Response(JSON.stringify(rows), { status: 200, headers: { 'content-type': 'application/json' } });
  });
}

const options = (fetchImpl: ReturnType<typeof fakeFetch>, now = () => 0) => ({
  supabaseUrl: 'https://projet.supabase.co',
  anonKey: 'anon',
  siteUrl: () => DEFAULT_SITE_URL,
  fetchImpl: fetchImpl as unknown as typeof fetch,
  now,
});

describe('blog pré-rendu serveur : lecture Supabase', () => {
  it('article publié → document enrichi ; requête limitée aux articles publiés', async () => {
    const fetchImpl = fakeFetch([POST]);
    const prerender = createBlogPrerender(options(fetchImpl));
    const out = await prerender.enrich({ page: '/(marketing)/blog/[slug]', pathname: '/blog/hypertension-reperes', html: SHELL });
    expect(out?.status).toBe(200);
    expect(out?.html).toContain('<h1>Hypertension : les repères à connaître</h1>');
    const url = String(fetchImpl.mock.calls[0][0]);
    expect(url).toContain('/rest/v1/blog_posts?');
    expect(url).toContain('status=eq.published');
    expect(url).toContain('slug=eq.hypertension-reperes');
  });

  it('article inconnu → 404 noindex (pas de « soft 404 »)', async () => {
    const prerender = createBlogPrerender(options(fakeFetch([])));
    const out = await prerender.enrich({ page: '/(marketing)/blog/[slug]', pathname: '/blog/absent', html: SHELL });
    expect(out?.status).toBe(404);
    expect(out?.html).toContain('name="robots" content="noindex, nofollow"');
    expect(out?.html).not.toContain('rel="canonical"');
  });

  it('Supabase en panne → null (coquille d’origine), puis disjoncteur 30 s sans nouvel appel', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let t = 0;
    const fetchImpl = fakeFetch(new Error('réseau'));
    const prerender = createBlogPrerender(options(fetchImpl, () => t));
    const request = { page: '/(marketing)/blog/[slug]', pathname: '/blog/x', html: SHELL };
    expect(await prerender.enrich(request)).toBeNull();
    t = 10_000;
    expect(await prerender.enrich(request)).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1); // pas d'attente répétée pendant la panne
    t = 31_000;
    expect(await prerender.enrich(request)).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(2); // nouvel essai après le délai
    warn.mockRestore();
  });

  it('met en cache (5 min pour un article, 30 s pour un absent)', async () => {
    let t = 0;
    const fetchImpl = fakeFetch([POST]);
    const prerender = createBlogPrerender(options(fetchImpl, () => t));
    const request = { page: '/(marketing)/blog/[slug]', pathname: '/blog/hypertension-reperes', html: SHELL };
    await prerender.enrich(request);
    t = 4 * 60_000;
    await prerender.enrich(request);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    t = 6 * 60_000;
    await prerender.enrich(request);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('liste du blog → liens crawlables vers les articles ; autres pages ignorées', async () => {
    const prerender = createBlogPrerender(options(fakeFetch([POST])));
    const list = await prerender.enrich({ page: '/(marketing)/blog/index', pathname: '/blog', html: SHELL });
    expect(list?.html).toContain('<a href="/blog/hypertension-reperes">Hypertension : les repères à connaître</a>');
    expect(await prerender.enrich({ page: '/index', pathname: '/', html: SHELL })).toBeNull();
  });

  it('sans configuration Supabase : inactif', () => {
    expect(createBlogPrerender({ siteUrl: () => DEFAULT_SITE_URL }).enabled).toBe(false);
  });
});

describe('service HTML avec document enrichi', () => {
  it('sert le document enrichi compressé, avec son statut et sa CSP', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'medinfo-html-'));
    fs.mkdirSync(path.join(dir, '_expo'));
    fs.mkdirSync(path.join(dir, '(marketing)', 'blog'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, '_expo', 'routes.json'),
      JSON.stringify({
        htmlRoutes: [{ page: '/(marketing)/blog/[slug]', namedRegex: '^(?:/\\(marketing\\))?/blog/(?<slug>[^/]+?)(?:/)?$' }],
        apiRoutes: [],
        notFoundRoutes: [],
      }),
    );
    fs.writeFileSync(path.join(dir, '(marketing)', 'blog', '[slug].html'), SHELL);
    const prerender = createBlogPrerender(options(fakeFetch([])));
    const handler = createHtmlHandler({ buildDir: dir, headersFor: (html: string) => ({ 'X-Len': String(html.length) }), enrich: prerender.enrich });
    const headers: Record<string, string> = {};
    let body: Buffer | undefined;
    const res = {
      statusCode: 0,
      setHeader: (name: string, value: string) => { headers[name.toLowerCase()] = value; },
      end: (chunk?: Buffer) => { body = chunk; },
    };
    const served = await handler({ method: 'GET', url: '/blog/absent', headers: { 'accept-encoding': 'gzip' } } as never, res as never);
    expect(served).toBe(true);
    expect(res.statusCode).toBe(404);
    expect(headers['content-encoding']).toBe('gzip');
    const html = zlib.gunzipSync(body as Buffer).toString('utf8');
    expect(html).toContain('Article introuvable');
    expect(headers['x-len']).toBe(String(html.length));
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
