/**
 * GET /sitemap.xml — sitemap dynamique (refonte SEO 2026-07).
 *
 * Pages statiques (src/seo/sitemap.ts) + articles de blog PUBLIÉS. La lecture des
 * articles utilise la clé anon (RLS : seuls les `published` sont visibles) ; si
 * Supabase est indisponible, le sitemap retombe sur les pages statiques seules
 * (fail-open documentaire : aucune donnée sensible ici, uniquement des URLs publiques).
 */
import { createClient } from '@supabase/supabase-js';

import { STATIC_SITEMAP_ENTRIES, buildSitemapXml, type SitemapEntry } from '@/seo/sitemap';

async function fetchBlogEntries(): Promise<SitemapEntry[]> {
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return [];

  try {
    const supabase = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await supabase
      .from('blog_posts')
      .select('slug, published_at')
      .order('published_at', { ascending: false })
      .limit(500);
    if (error || !data) return [];
    return data
      .filter((post): post is { slug: string; published_at: string | null } => Boolean(post.slug))
      .map((post) => ({
        path: `/blog/${post.slug}`,
        lastmod: post.published_at,
        changefreq: 'monthly' as const,
        priority: 0.6,
      }));
  } catch {
    return [];
  }
}

export async function GET(): Promise<Response> {
  const blogEntries = await fetchBlogEntries();
  const xml = buildSitemapXml([...STATIC_SITEMAP_ENTRIES, ...blogEntries]);
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // Cache CDN 1 h : le sitemap n'a pas besoin d'être temps réel.
      'Cache-Control': 'public, max-age=0, s-maxage=3600',
    },
  });
}
