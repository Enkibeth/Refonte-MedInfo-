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
  'liens vérifiés, 3 chatbots pour le grand public, les étudiants et les professionnels de santé.';

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

/** Image de partage social par défaut (public/og-image.png, copiée du logo). */
export function defaultOgImageUrl(): string {
  return canonicalUrl('/og-image.png');
}

export function organizationJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: `${siteUrl()}/`,
    logo: defaultOgImageUrl(),
    description: DEFAULT_DESCRIPTION,
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      url: canonicalUrl('/contact'),
      availableLanguage: 'French',
    },
  };
}

/**
 * Fiche schema.org WebApplication d'un outil du site (SEO par feature, 2026-07).
 * Décrit chaque outil (analyse de document, ECOS, CV…) comme une application web
 * gratuite de la catégorie santé — sans jamais aucune donnée d'utilisateur.
 */
export function webApplicationJsonLd(app: {
  name: string;
  description: string;
  path: string;
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: app.name,
    description: app.description,
    url: canonicalUrl(app.path),
    applicationCategory: 'HealthApplication',
    operatingSystem: 'Web',
    inLanguage: 'fr-FR',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: `${siteUrl()}/` },
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

  // ── Outils par feature (refonte SEO 2026-07) : chaque outil a son titre et sa
  //    description orientés intention de recherche, son canonical et sa fiche
  //    WebApplication — les écrans restent protégés par RoleGate côté produit. ──
  document: {
    path: '/document',
    title: 'Analyse de document médical par IA — explication claire',
    description:
      "Déposez un compte rendu, une ordonnance ou un résultat d'analyse : l'IA l'explique " +
      'en langage clair, avec des citations tirées mot pour mot du document.',
  },
  ecos: {
    path: '/ecos',
    title: 'Simulation ECOS en ligne — patient virtuel et note sur 20',
    description:
      'Entraînez-vous aux ECOS avec un patient simulé par IA : cas fictifs par spécialité, ' +
      'évaluation sur grille, note sur 20 et historique de vos passages.',
  },
  revision: {
    path: '/revision',
    title: 'Planning de révisions médecine — planificateur intelligent',
    description:
      "Construisez un planning de révisions réaliste pour vos partiels ou l'EDN : charge " +
      'quotidienne calculée, redistribution automatique, jauge de risque.',
  },
  partiel: {
    path: '/partiel',
    title: 'Analyse des partiels — classement de promo et statistiques',
    description:
      'Importez les notes de votre promo (Excel, CSV, PDF) : rang, quantiles, distributions ' +
      "et comparaison d'épreuves. Calcul 100 % local, aucune note envoyée.",
  },
  audio: {
    path: '/audio',
    title: 'Compte rendu de consultation par dictée vocale — IA',
    description:
      'Dictez votre consultation : transcription puis compte rendu structuré par IA. Audio ' +
      'purgé sous 24 h, bibliothèque privée sécurisée, export PDF.',
  },
  presentation: {
    path: '/presentation',
    title: 'Générateur de présentations médicales — export PowerPoint',
    description:
      "Créez des présentations médicales soignées, à la main ou avec l'IA, et exportez-les " +
      'en PPTX compatible PowerPoint et Keynote. Historique cloud inclus.',
  },
  cvBuilder: {
    path: '/cv-builder',
    title: 'Créateur de CV médical en ligne — modèle pro, export PDF',
    description:
      'Rédigez un CV médical convaincant : gabarit deux colonnes, aperçu A4 en direct, ' +
      'import de votre CV existant, relecture IA et export PDF net.',
  },
  article: {
    path: '/article',
    title: "Rédaction d'article médical — IMRaD, citations Vancouver",
    description:
      'Structurez votre manuscrit scientifique : gabarits IMRaD, compteurs par section, ' +
      'bibliographie DOI/PMID, citations Vancouver ou APA, export Word.',
  },
  scores: {
    path: '/scores',
    title: 'Scores médicaux — calculateurs cliniques et interprétation',
    description:
      'Calculez les scores médicaux courants (CHA₂DS₂-VASc, Glasgow, CURB-65, CKD-EPI, MELD…) : ' +
      'boutons interactifs, interprétation immédiate, recherche par nom ou par fonction.',
  },

  // ── Pages légales : indexables, description honnête (confiance E-E-A-T). ──
  mentionsLegales: {
    path: '/mentions-legales',
    title: 'Mentions légales',
    description:
      'Éditeur, hébergement et contacts du site MedInfo AI : les informations prévues par ' +
      "la loi pour la confiance dans l'économie numérique (LCEN).",
  },
  cgu: {
    path: '/cgu',
    title: "Conditions générales d'utilisation (CGU)",
    description:
      "Les règles d'utilisation de MedInfo AI : information médicale générale, comptes et " +
      'rôles vérifiés, abonnements, responsabilités et bon usage du service.',
  },
  confidentialite: {
    path: '/confidentialite',
    title: 'Politique de confidentialité et données personnelles (RGPD)',
    description:
      'Quelles données MedInfo AI traite, pourquoi et combien de temps : historique de chat ' +
      'privé, documents jamais stockés, droits RGPD et contact.',
  },
  legal: {
    path: '/legal',
    title: 'Informations légales et conformité',
    description:
      'Toutes les informations légales de MedInfo AI : mentions légales, CGU, politique de ' +
      "confidentialité et engagement de transparence sur l'IA (AI Act).",
  },
} as const satisfies Record<string, PageSeo>;

export type PageSeoKey = keyof typeof PAGE_SEO;
