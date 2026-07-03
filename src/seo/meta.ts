/**
 * SEO — source unique des métadonnées du site (refonte landing 2026-07).
 *
 * ⚠️ Module PUR et testable : aucune dépendance React/React Native, aucune donnée
 * de santé. Consommé par le composant <SeoHead> (src/ui/SeoHead.tsx), la route
 * /sitemap.xml et les pages marketing.
 *
 * Conventions « grande tech » appliquées :
 *  - titre ≤ ~60 caractères, suffixe de marque unique (« — MedInfo AI ») ;
 *  - description ≤ ~160 caractères, orientée intention de recherche ;
 *  - URL canonique absolue sans slash final ;
 *  - données structurées schema.org (Organization, WebSite, FAQPage, BlogPosting,
 *    Breadcrumb) injectées en JSON-LD.
 */

export const SITE_NAME = 'MedInfo AI';

/** URL de prod par défaut (docs/TODO.md) — surchargée par EXPO_PUBLIC_APP_URL. */
export const DEFAULT_SITE_URL = 'https://refonte-med-info.vercel.app';

export const DEFAULT_DESCRIPTION =
  "Assistant IA d'information médicale en français : réponses sourcées (HAS, ANSM, PubMed), " +
  'liens vérifiés, 3 chatbots — grand public, étudiants et professionnels de santé.';

/** Base absolue du site, sans slash final. */
export function siteUrl(): string {
  const raw = process.env.EXPO_PUBLIC_APP_URL?.trim();
  const base = raw && /^https?:\/\//.test(raw) ? raw : DEFAULT_SITE_URL;
  return base.replace(/\/+$/, '');
}

/** URL canonique absolue d'un chemin (`/blog`, `blog`, `/` acceptés). */
export function canonicalUrl(path: string): string {
  const clean = path.trim();
  if (!clean || clean === '/') return `${siteUrl()}/`;
  return `${siteUrl()}/${clean.replace(/^\/+/, '').replace(/\/+$/, '')}`;
}

/** Titre complet d'onglet : suffixe de marque ajouté une seule fois. */
export function pageTitle(title: string): string {
  const t = title.trim();
  if (!t) return SITE_NAME;
  return t.includes(SITE_NAME) ? t : `${t} — ${SITE_NAME}`;
}

// ─── Données structurées schema.org (JSON-LD) ───

export interface FaqItem {
  question: string;
  answer: string;
}

export function organizationJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: `${siteUrl()}/`,
    description: DEFAULT_DESCRIPTION,
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      url: canonicalUrl('/contact'),
      availableLanguage: 'French',
    },
  };
}

export function webSiteJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: `${siteUrl()}/`,
    inLanguage: 'fr-FR',
  };
}

export function faqPageJsonLd(items: FaqItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

export interface BlogPostingSeo {
  slug: string;
  title: string;
  summary: string | null;
  coverImageUrl: string | null;
  publishedAt: string | null;
  category: string | null;
}

export function blogPostingJsonLd(post: BlogPostingSeo): Record<string, unknown> {
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    url: canonicalUrl(`/blog/${post.slug}`),
    inLanguage: 'fr-FR',
    publisher: { '@type': 'Organization', name: SITE_NAME, url: `${siteUrl()}/` },
    author: { '@type': 'Organization', name: SITE_NAME },
  };
  if (post.summary) jsonLd.description = post.summary;
  if (post.coverImageUrl) jsonLd.image = post.coverImageUrl;
  if (post.publishedAt) jsonLd.datePublished = post.publishedAt;
  if (post.category) jsonLd.articleSection = post.category;
  return jsonLd;
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: canonicalUrl(item.path),
    })),
  };
}

// ─── Métadonnées par page (source unique, réutilisée par le sitemap) ───

export interface PageSeo {
  /** Chemin public (sans groupe expo-router) — sert aussi au sitemap. */
  path: string;
  title: string;
  description: string;
}

export const PAGE_SEO = {
  home: {
    path: '/',
    title: 'MedInfo AI — Assistant IA médical : réponses sourcées et vérifiées',
    description:
      'Posez vos questions de santé à une IA qui recherche les sources en direct (HAS, ANSM, ' +
      'Europe PMC, ClinicalTrials.gov) et vérifie chaque lien. Essai gratuit sans inscription.',
  },
  about: {
    path: '/a-propos',
    title: 'À propos — notre mission et notre méthode',
    description:
      "MedInfo AI rend l'information médicale fiable et accessible : 3 chatbots spécialisés, " +
      'sources officielles citées et liens vérifiés à chaque réponse. Découvrez notre démarche.',
  },
  contact: {
    path: '/contact',
    title: 'Contact — support, partenariats et données personnelles',
    description:
      "Contactez l'équipe MedInfo AI : support compte, presse et partenariats, exercice de vos " +
      'droits RGPD. Réponse sous 48 h ouvrées.',
  },
  blog: {
    path: '/blog',
    title: 'Blog santé — articles sourcés et relus',
    description:
      "Prévention, traitements, idées reçues : des articles d'information médicale générale, " +
      'sourcés et relus, publiés chaque semaine par MedInfo AI.',
  },
  pricing: {
    path: '/pricing',
    title: 'Tarifs — offres grand public et étudiants',
    description:
      'Comparez les offres MedInfo AI : essai gratuit, abonnements grand public et étudiants. ' +
      'Les sources officielles (HAS, ANSM) restent gratuites pour tous.',
  },
  chat: {
    path: '/chat',
    title: 'Chat santé IA — posez votre question, réponse sourcée',
    description:
      'Chat IA médical en français : réponses claires appuyées sur des sources réelles et ' +
      'vérifiées (HAS, ANSM, PubMed). Premier message gratuit, sans inscription.',
  },
} as const satisfies Record<string, PageSeo>;

export type PageSeoKey = keyof typeof PAGE_SEO;
