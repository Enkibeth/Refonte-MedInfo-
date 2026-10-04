/**
 * Pré-rendu serveur du BLOG pour les lecteurs qui n'exécutent pas JavaScript.
 *
 * Les articles sont servis par une coquille unique (`blog/[slug].html`) pré-rendue sans
 * connaître l'article : un aperçu de lien (LinkedIn, WhatsApp, X, Slack…) et les robots des
 * moteurs de réponse IA (qui ne lancent pas JavaScript) voyaient le titre générique du blog
 * pour CHAQUE article, sans son texte. Ce module, branché sur `server/lib/html.mjs` :
 *  - remplace les métadonnées de la coquille (titre, description, canonical, robots, Open
 *    Graph, Twitter, JSON-LD BlogPosting + fil d'Ariane) par celles de l'article ;
 *  - ajoute l'article dans un `<noscript>` HORS de `#root` (React n'hydrate que `#root` :
 *    aucun risque d'écart d'hydratation ; c'est le même contenu que la page rendue) ;
 *  - répond 404 (et noindex) à un article inconnu, au lieu d'une « soft 404 » ;
 *  - fait de même pour la liste du blog (liens crawlables vers les articles).
 * Les balises portent `data-rh="true"` : côté client, la tête est reprise par react-helmet
 * (expo-router/head) comme si elle venait du pré-rendu.
 *
 * Lecture Supabase par la clé ANON (la RLS ne montre que les articles publiés), délai borné,
 * cache court en mémoire, et repli intégral : en cas d'erreur, la coquille d'origine est
 * servie inchangée. À garder aligné avec `src/ui/SeoHead.tsx` et `src/seo/meta.ts`
 * (`blogPostingJsonLd`) : `tests/unit/blog-prerender.test.ts` compare les deux.
 */

const SITE_NAME = 'MedInfo AI';
/** Description de la liste du blog : PAGE_SEO.blog.description (src/seo/meta.ts, test). */
const BLOG_DESCRIPTION =
  'Prévention, traitements, idées reçues : des articles d’information médicale générale, ' +
  'avec leurs sources, publiés par MedInfo AI.';
const INDEXABLE_ROBOTS = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
const SOCIAL_CARD = { path: '/social-card.png', width: 1200, height: 630, type: 'image/png', alt: 'MedInfo AI : l’IA pour apprendre, des outils pour créer.' };

export const ARTICLE_PAGE = '/(marketing)/blog/[slug]';
export const BLOG_INDEX_PAGE = '/(marketing)/blog/index';
const POST_COLUMNS = 'slug,title,summary,category,cover_image_url,content_md,published_at,updated_at';
const LIST_COLUMNS = 'slug,title,summary,category,published_at';

/**
 * Base absolue du site, sans slash final : même règle que `siteUrl()` (src/seo/meta.ts) —
 * `EXPO_PUBLIC_APP_URL` si c'est une URL http(s), sinon le domaine de production.
 * @param {Record<string, string | undefined>} env
 */
export function publicSiteUrl(env) {
  const raw = env?.EXPO_PUBLIC_APP_URL?.trim();
  const base = raw && /^https?:\/\//.test(raw) ? raw : 'https://medinfo-ai.com';
  return base.replace(/\/+$/, '');
}

/** Échappement HTML (texte et valeurs d'attributs). */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/** Titre complet d'onglet (même règle que `pageTitle`, src/seo/meta.ts). */
export function fullTitle(title) {
  const t = String(title ?? '').trim();
  if (!t) return SITE_NAME;
  return t.includes(SITE_NAME) ? t : `${t} | ${SITE_NAME}`;
}

/** Slug d'un chemin d'article (`/blog/mon-article`), ou null. */
export function blogSlugFrom(pathname) {
  const match = /^\/blog\/([^/]+?)\/?$/.exec(pathname);
  if (!match) return null;
  let slug;
  try {
    slug = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  // eslint-disable-next-line no-control-regex
  if (!slug || slug.length > 200 || /[\u0000-\u001f\u007f/]/.test(slug)) return null;
  return slug;
}

const safeUrl = (url) => (/^https?:\/\//i.test(String(url ?? '').trim()) ? String(url).trim() : null);

/** Mise en forme en ligne : code, gras, italique, liens et images http(s) — tout le reste est échappé. */
function inline(text) {
  const parts = [];
  let rest = String(text);
  // Liens et images d'abord (leurs textes sont échappés à part).
  const re = /(!?)\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let last = 0;
  let m;
  while ((m = re.exec(rest))) {
    parts.push(emphasis(escapeHtml(rest.slice(last, m.index))));
    const url = safeUrl(m[3]);
    if (!url) parts.push(emphasis(escapeHtml(m[2])));
    else if (m[1]) parts.push(`<img src="${escapeHtml(url)}" alt="${escapeHtml(m[2])}" loading="lazy">`);
    else parts.push(`<a href="${escapeHtml(url)}" rel="noopener">${emphasis(escapeHtml(m[2]))}</a>`);
    last = m.index + m[0].length;
  }
  parts.push(emphasis(escapeHtml(rest.slice(last))));
  return parts.join('');
}

function emphasis(escaped) {
  return escaped
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>')
    .replace(/(^|[^_\w])_([^_\s][^_]*?)_(?!\w)/g, '$1<em>$2</em>');
}

/**
 * Markdown d'article → HTML simple et sûr (titres, paragraphes, listes, citations, filets,
 * gras/italique, liens et images http(s)). Aucun HTML brut n'est conservé.
 */
export function markdownToHtml(md) {
  const lines = String(md ?? '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let paragraph = [];
  let list = null; // { tag: 'ul' | 'ol', items: string[] }
  const flushParagraph = () => {
    if (paragraph.length) out.push(`<p>${inline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list) out.push(`<${list.tag}>${list.items.map((item) => `<li>${inline(item)}</li>`).join('')}</${list.tag}>`);
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      // Le titre de l'article est le seul h1 : les sections commencent au h2.
      const level = Math.min(6, Math.max(2, heading[1].length));
      out.push(`<h${level}>${inline(heading[2].trim())}</h${level}>`);
    } else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flushParagraph();
      flushList();
      out.push('<hr>');
    } else if (bullet || ordered) {
      flushParagraph();
      const tag = bullet ? 'ul' : 'ol';
      if (list && list.tag !== tag) flushList();
      list ??= { tag, items: [] };
      list.items.push((bullet ?? ordered)[1]);
    } else if (/^>\s?/.test(line)) {
      flushParagraph();
      flushList();
      out.push(`<blockquote><p>${inline(line.replace(/^>\s?/, ''))}</p></blockquote>`);
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  flushList();
  return out.join('\n');
}

function formatDateFr(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });
}

/** JSON-LD BlogPosting d'un article (aligné sur `blogPostingJsonLd`, src/seo/meta.ts). */
export function articleJsonLd(post, site) {
  const url = `${site}/blog/${post.slug}`;
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    inLanguage: 'fr-FR',
    image: safeUrl(post.cover_image_url) ?? `${site}${SOCIAL_CARD.path}`,
    publisher: { '@type': 'Organization', '@id': `${site}/#organization`, name: SITE_NAME, url: `${site}/`, logo: { '@type': 'ImageObject', url: `${site}/og-image.png` } },
    author: { '@type': 'Organization', '@id': `${site}/#organization`, name: SITE_NAME, url: `${site}/` },
  };
  if (post.summary) data.description = post.summary;
  if (post.published_at) data.datePublished = post.published_at;
  const modified = post.updated_at ?? post.published_at;
  if (modified) data.dateModified = modified;
  if (post.category) data.articleSection = post.category;
  return data;
}

function breadcrumb(site, items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: `${site}${item.path}` })),
  };
}

/** Sérialisation JSON-LD sûre dans un `<script>` (aucune fermeture de balise possible). */
const ldJson = (data) => JSON.stringify(data).replace(/</g, '\\u003c');

/**
 * Balises de tête d'une page (même jeu que `<SeoHead>`).
 * @param {{ title: string; description: string; url: string; image?: string | null; imageAlt?: string; type?: 'website' | 'article'; noindex?: boolean; jsonLd?: object[]; article?: { publishedTime?: string | null; modifiedTime?: string | null; section?: string | null } }} meta
 */
export function headTags(meta) {
  const title = fullTitle(meta.title);
  const site = new URL(meta.url).origin;
  const image = safeUrl(meta.image);
  const ogImage = image ?? `${site}${SOCIAL_CARD.path}`;
  const ogImageAlt = image ? meta.imageAlt ?? title : SOCIAL_CARD.alt;
  const tag = (attrs) => `<meta data-rh="true" ${attrs}/>`;
  const tags = [
    `<title data-rh="true">${escapeHtml(title)}</title>`,
    tag(`name="description" content="${escapeHtml(meta.description)}"`),
    tag(`name="robots" content="${meta.noindex ? 'noindex, nofollow' : INDEXABLE_ROBOTS}"`),
  ];
  if (!meta.noindex) tags.push(`<link data-rh="true" rel="canonical" href="${escapeHtml(meta.url)}"/>`);
  tags.push(
    tag(`property="og:site_name" content="${SITE_NAME}"`),
    tag('property="og:locale" content="fr_FR"'),
    tag(`property="og:type" content="${meta.type ?? 'website'}"`),
    tag(`property="og:title" content="${escapeHtml(title)}"`),
    tag(`property="og:description" content="${escapeHtml(meta.description)}"`),
    tag(`property="og:url" content="${escapeHtml(meta.url)}"`),
    tag(`property="og:image" content="${escapeHtml(ogImage)}"`),
    tag(`property="og:image:alt" content="${escapeHtml(ogImageAlt)}"`),
  );
  if (!image) {
    tags.push(
      tag(`property="og:image:type" content="${SOCIAL_CARD.type}"`),
      tag(`property="og:image:width" content="${SOCIAL_CARD.width}"`),
      tag(`property="og:image:height" content="${SOCIAL_CARD.height}"`),
    );
  }
  if (meta.article?.publishedTime) tags.push(tag(`property="article:published_time" content="${escapeHtml(meta.article.publishedTime)}"`));
  if (meta.article?.modifiedTime) tags.push(tag(`property="article:modified_time" content="${escapeHtml(meta.article.modifiedTime)}"`));
  if (meta.article?.section) tags.push(tag(`property="article:section" content="${escapeHtml(meta.article.section)}"`));
  tags.push(
    tag('name="twitter:card" content="summary_large_image"'),
    tag(`name="twitter:title" content="${escapeHtml(title)}"`),
    tag(`name="twitter:description" content="${escapeHtml(meta.description)}"`),
    tag(`name="twitter:image" content="${escapeHtml(ogImage)}"`),
    tag(`name="twitter:image:alt" content="${escapeHtml(ogImageAlt)}"`),
  );
  for (const data of meta.jsonLd ?? []) tags.push(`<script data-rh="true" type="application/ld+json">${ldJson(data)}</script>`);
  return tags.join('');
}

/** Remplace les balises gérées par react-helmet (`data-rh`) de la tête par `tags`. */
export function replaceHeadTags(html, tags) {
  const headEnd = html.indexOf('</head>');
  if (headEnd < 0) return html;
  let head = html.slice(0, headEnd);
  const body = html.slice(headEnd);
  head = head
    .replace(/<title data-rh="true"[^>]*>[\s\S]*?<\/title>/g, '')
    .replace(/<script data-rh="true"[^>]*>[\s\S]*?<\/script>/g, '')
    .replace(/<(meta|link) data-rh="true"[^>]*\/?>/g, '');
  const at = head.indexOf('<head>');
  if (at < 0) return html;
  const insertAt = at + '<head>'.length;
  return head.slice(0, insertAt) + tags + head.slice(insertAt) + body;
}

/** Ajoute un bloc `<noscript>` juste après `<body …>` (hors de `#root`). */
export function insertNoscript(html, content) {
  const match = /<body[^>]*>/.exec(html);
  if (!match) return html;
  const at = match.index + match[0].length;
  return `${html.slice(0, at)}<noscript>${content}</noscript>${html.slice(at)}`;
}

/** Document d'un article publié. */
export function renderArticleDocument(shell, post, site) {
  const url = `${site}/blog/${post.slug}`;
  const description = post.summary || BLOG_DESCRIPTION;
  const tags = headTags({
    title: post.title,
    description,
    url,
    image: post.cover_image_url,
    imageAlt: post.title,
    type: 'article',
    article: { publishedTime: post.published_at, modifiedTime: post.updated_at ?? post.published_at, section: post.category },
    jsonLd: [
      articleJsonLd(post, site),
      breadcrumb(site, [
        { name: 'Accueil', path: '/' },
        { name: 'Blog', path: '/blog' },
        { name: post.title, path: `/blog/${post.slug}` },
      ]),
    ],
  });
  const date = formatDateFr(post.published_at);
  const article = [
    '<article>',
    `<p><a href="/blog">Blog</a>${post.category ? ` · ${escapeHtml(post.category)}` : ''}</p>`,
    `<h1>${escapeHtml(post.title)}</h1>`,
    date ? `<p><time datetime="${escapeHtml(post.published_at)}">Publié le ${escapeHtml(date)}</time></p>` : '',
    post.summary ? `<p><strong>${escapeHtml(post.summary)}</strong></p>` : '',
    markdownToHtml(post.content_md),
    '</article>',
  ].join('');
  return insertNoscript(replaceHeadTags(shell, tags), article);
}

/** Document d'un article inconnu ou dépublié (servi en 404). */
export function renderMissingArticleDocument(shell, site) {
  const tags = headTags({ title: 'Article introuvable', description: BLOG_DESCRIPTION, url: `${site}/blog`, noindex: true });
  return insertNoscript(replaceHeadTags(shell, tags), '<p>Cet article est introuvable. <a href="/blog">Voir tous les articles</a></p>');
}

/** Liste du blog : métadonnées inchangées, liens vers les articles pour les lecteurs sans JS. */
export function renderBlogIndexDocument(shell, posts) {
  if (!posts.length) return shell;
  const items = posts
    .filter((post) => post.slug && post.title)
    .map((post) => {
      const date = formatDateFr(post.published_at);
      return `<li><a href="/blog/${encodeURIComponent(post.slug)}">${escapeHtml(post.title)}</a>${date ? ` (${escapeHtml(date)})` : ''}${post.summary ? `<p>${escapeHtml(post.summary)}</p>` : ''}</li>`;
    })
    .join('');
  return insertNoscript(shell, `<h2>Articles récents</h2><ul>${items}</ul>`);
}

/**
 * @param {{ supabaseUrl?: string; anonKey?: string; siteUrl: () => string; fetchImpl?: typeof fetch; now?: () => number; ttlMs?: number; missTtlMs?: number; timeoutMs?: number; maxEntries?: number }} options
 */
export function createBlogPrerender(options) {
  const { supabaseUrl, anonKey, siteUrl } = options;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const now = options.now ?? Date.now;
  const ttlMs = options.ttlMs ?? 5 * 60_000;
  const missTtlMs = options.missTtlMs ?? 60_000;
  const timeoutMs = options.timeoutMs ?? 1500;
  const maxEntries = options.maxEntries ?? 300;
  /** @type {Map<string, { expires: number; value: any }>} */
  const cache = new Map();

  const enabled = Boolean(supabaseUrl && anonKey && fetchImpl);

  async function rest(query) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(`${supabaseUrl.replace(/\/+$/, '')}/rest/v1/blog_posts?${query}`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Supabase ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('réponse inattendue');
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  async function cached(key, load, ttlFor) {
    const hit = cache.get(key);
    if (hit && hit.expires > now()) return hit.value;
    const value = await load();
    if (cache.size >= maxEntries) cache.delete(cache.keys().next().value);
    cache.set(key, { expires: now() + ttlFor(value), value });
    return value;
  }

  return {
    enabled,
    /**
     * Document enrichi pour cette page, ou null (coquille d'origine servie inchangée).
     * @param {{ page: string; pathname: string; html: string }} request
     * @returns {Promise<{ html: string; status: number } | null>}
     */
    async enrich({ page, pathname, html }) {
      if (!enabled) return null;
      const site = siteUrl();
      try {
        if (page === ARTICLE_PAGE) {
          const slug = blogSlugFrom(pathname);
          if (!slug) return null;
          const rows = await cached(
            `post:${slug}`,
            () => rest(`select=${POST_COLUMNS}&slug=eq.${encodeURIComponent(slug)}&status=eq.published&limit=1`),
            (value) => (value.length ? ttlMs : missTtlMs),
          );
          const post = rows[0];
          if (!post || !post.title || typeof post.content_md !== 'string') {
            return { html: renderMissingArticleDocument(html, site), status: 404 };
          }
          return { html: renderArticleDocument(html, post, site), status: 200 };
        }
        if (page === BLOG_INDEX_PAGE) {
          const rows = await cached(
            'list',
            () => rest(`select=${LIST_COLUMNS}&status=eq.published&order=published_at.desc&limit=50`),
            () => ttlMs,
          );
          return { html: renderBlogIndexDocument(html, rows), status: 200 };
        }
      } catch (error) {
        console.warn(`[medinfo] pré-rendu du blog indisponible (${pathname}) : ${error?.message ?? error}`);
      }
      return null;
    },
  };
}
