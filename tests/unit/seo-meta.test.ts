import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_SITE_URL,
  PAGE_SEO,
  SITE_NAME,
  blogPostingJsonLd,
  breadcrumbJsonLd,
  canonicalUrl,
  faqPageJsonLd,
  organizationJsonLd,
  pageTitle,
  siteUrl,
  webSiteJsonLd,
} from '@/seo/meta';
import { STATIC_SITEMAP_ENTRIES, buildSitemapXml } from '@/seo/sitemap';

const ORIGINAL_APP_URL = process.env.EXPO_PUBLIC_APP_URL;

// Les assertions ci-dessous supposent l'URL par défaut : on neutralise la variable
// d'env avant chaque test et on la restaure à la fin de la suite.
beforeEach(() => {
  delete process.env.EXPO_PUBLIC_APP_URL;
});

afterAll(() => {
  if (ORIGINAL_APP_URL === undefined) delete process.env.EXPO_PUBLIC_APP_URL;
  else process.env.EXPO_PUBLIC_APP_URL = ORIGINAL_APP_URL;
});

describe('siteUrl / canonicalUrl', () => {
  it('retombe sur l’URL de prod par défaut sans variable d’env', () => {
    expect(siteUrl()).toBe(DEFAULT_SITE_URL);
  });

  it('utilise EXPO_PUBLIC_APP_URL en retirant le slash final', () => {
    process.env.EXPO_PUBLIC_APP_URL = 'https://medinfo.example.com/';
    expect(siteUrl()).toBe('https://medinfo.example.com');
    expect(canonicalUrl('/blog')).toBe('https://medinfo.example.com/blog');
  });

  it('ignore une valeur d’env invalide (pas une URL http)', () => {
    process.env.EXPO_PUBLIC_APP_URL = 'pas-une-url';
    expect(siteUrl()).toBe(DEFAULT_SITE_URL);
  });

  it('normalise les chemins (slashs, racine)', () => {
    expect(canonicalUrl('/')).toBe(`${DEFAULT_SITE_URL}/`);
    expect(canonicalUrl('')).toBe(`${DEFAULT_SITE_URL}/`);
    expect(canonicalUrl('blog')).toBe(`${DEFAULT_SITE_URL}/blog`);
    expect(canonicalUrl('/blog/')).toBe(`${DEFAULT_SITE_URL}/blog`);
    expect(canonicalUrl('/blog/mon-article')).toBe(`${DEFAULT_SITE_URL}/blog/mon-article`);
  });
});

describe('pageTitle', () => {
  it('ajoute le suffixe de marque une seule fois', () => {
    expect(pageTitle('Contact')).toBe('Contact — MedInfo AI');
    expect(pageTitle('MedInfo AI — Assistant IA médical')).toBe('MedInfo AI — Assistant IA médical');
    expect(pageTitle('  ')).toBe(SITE_NAME);
  });
});

describe('PAGE_SEO (budgets SEO)', () => {
  it('chaque page a un chemin absolu, un titre et une description bornés', () => {
    for (const page of Object.values(PAGE_SEO)) {
      expect(page.path.startsWith('/')).toBe(true);
      expect(page.title.length).toBeGreaterThan(10);
      expect(page.title.length).toBeLessThanOrEqual(75);
      expect(page.description.length).toBeGreaterThan(50);
      expect(page.description.length).toBeLessThanOrEqual(175);
    }
  });
});

describe('JSON-LD', () => {
  it('Organization et WebSite pointent vers le site', () => {
    const org = organizationJsonLd();
    expect(org['@type']).toBe('Organization');
    expect(org.url).toBe(`${DEFAULT_SITE_URL}/`);
    const site = webSiteJsonLd();
    expect(site['@type']).toBe('WebSite');
    expect(site.inLanguage).toBe('fr-FR');
  });

  it('FAQPage mappe questions et réponses', () => {
    const faq = faqPageJsonLd([{ question: 'Q1 ?', answer: 'R1.' }]);
    const entities = faq.mainEntity as { name: string; acceptedAnswer: { text: string } }[];
    expect(entities).toHaveLength(1);
    expect(entities[0].name).toBe('Q1 ?');
    expect(entities[0].acceptedAnswer.text).toBe('R1.');
  });

  it('BlogPosting omet les champs absents et garde l’URL canonique', () => {
    const jsonLd = blogPostingJsonLd({
      slug: 'mon-article',
      title: 'Mon article',
      summary: null,
      coverImageUrl: null,
      publishedAt: '2026-07-01T06:00:00Z',
      category: 'Prévention',
    });
    expect(jsonLd.url).toBe(`${DEFAULT_SITE_URL}/blog/mon-article`);
    expect(jsonLd.datePublished).toBe('2026-07-01T06:00:00Z');
    expect(jsonLd.articleSection).toBe('Prévention');
    expect('description' in jsonLd).toBe(false);
    expect('image' in jsonLd).toBe(false);
  });

  it('BreadcrumbList numérote les positions à partir de 1', () => {
    const jsonLd = breadcrumbJsonLd([
      { name: 'Accueil', path: '/' },
      { name: 'Blog', path: '/blog' },
    ]);
    const items = jsonLd.itemListElement as { position: number; item: string }[];
    expect(items[0].position).toBe(1);
    expect(items[1].item).toBe(`${DEFAULT_SITE_URL}/blog`);
  });
});

describe('sitemap', () => {
  it('les entrées statiques couvrent les pages marketing et légales', () => {
    const paths = STATIC_SITEMAP_ENTRIES.map((e) => e.path);
    for (const expected of ['/', '/chat', '/blog', '/a-propos', '/pricing', '/contact', '/cgu']) {
      expect(paths).toContain(expected);
    }
  });

  it('produit un XML valide avec loc absolus et lastmod tronqué au jour', () => {
    const xml = buildSitemapXml([
      { path: '/', priority: 1 },
      { path: '/blog/mon-article', lastmod: '2026-07-01T06:00:00Z', changefreq: 'monthly' },
    ]);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain(`<loc>${DEFAULT_SITE_URL}/</loc>`);
    expect(xml).toContain(`<loc>${DEFAULT_SITE_URL}/blog/mon-article</loc>`);
    expect(xml).toContain('<lastmod>2026-07-01</lastmod>');
    expect(xml).toContain('<priority>1.0</priority>');
    expect(xml).not.toContain('<lastmod></lastmod>');
  });

  it('échappe les caractères XML dans les URLs', () => {
    const xml = buildSitemapXml([{ path: '/blog/a&b' }]);
    expect(xml).toContain('a&amp;b');
  });
});
