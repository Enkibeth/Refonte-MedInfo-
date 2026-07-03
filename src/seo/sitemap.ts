/**
 * Sitemap XML — construction pure (testable), consommée par app/sitemap.xml+api.ts.
 * Aucune donnée de santé : uniquement des URLs publiques.
 */
import { canonicalUrl, PAGE_SEO } from '@/seo/meta';

export interface SitemapEntry {
  /** Chemin public (`/blog`, `/a-propos`…). */
  path: string;
  /** Date ISO de dernière modification (optionnelle). */
  lastmod?: string | null;
  changefreq?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority?: number;
}

/** Pages statiques indexables (marketing + légal + chat public). */
export const STATIC_SITEMAP_ENTRIES: SitemapEntry[] = [
  { path: PAGE_SEO.home.path, changefreq: 'weekly', priority: 1 },
  { path: PAGE_SEO.chat.path, changefreq: 'weekly', priority: 0.9 },
  { path: PAGE_SEO.blog.path, changefreq: 'weekly', priority: 0.8 },
  { path: PAGE_SEO.about.path, changefreq: 'monthly', priority: 0.7 },
  { path: PAGE_SEO.pricing.path, changefreq: 'monthly', priority: 0.7 },
  { path: PAGE_SEO.contact.path, changefreq: 'monthly', priority: 0.5 },
  { path: '/mentions-legales', changefreq: 'yearly', priority: 0.3 },
  { path: '/cgu', changefreq: 'yearly', priority: 0.3 },
  { path: '/confidentialite', changefreq: 'yearly', priority: 0.3 },
];

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Sérialise les entrées en sitemap XML conforme sitemaps.org. */
export function buildSitemapXml(entries: SitemapEntry[]): string {
  const urls = entries
    .map((entry) => {
      const parts = [`    <loc>${escapeXml(canonicalUrl(entry.path))}</loc>`];
      if (entry.lastmod) {
        const day = entry.lastmod.slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(day)) parts.push(`    <lastmod>${day}</lastmod>`);
      }
      if (entry.changefreq) parts.push(`    <changefreq>${entry.changefreq}</changefreq>`);
      if (entry.priority != null) {
        parts.push(`    <priority>${entry.priority.toFixed(1)}</priority>`);
      }
      return `  <url>\n${parts.join('\n')}\n  </url>`;
    })
    .join('\n');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    `${urls}\n` +
    '</urlset>\n'
  );
}
