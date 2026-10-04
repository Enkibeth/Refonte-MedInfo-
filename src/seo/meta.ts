/**
 * SEO — source unique des métadonnées du site (refonte landing 2026-07).
 *
 * ⚠️ Module PUR et testable : aucune dépendance React/React Native, aucune donnée
 * de santé. Consommé par le composant <SeoHead> (src/ui/SeoHead.tsx), la route
 * /sitemap.xml et les pages marketing.
 *
 * Conventions « grande tech » appliquées :
 *  - titre ≤ ~60 caractères, suffixe de marque unique (« | MedInfo AI » : séparateur neutre,
 *    sans tiret cadratin) ;
 *  - description ≤ ~160 caractères, orientée intention de recherche ;
 *  - URL canonique absolue sans slash final ;
 *  - données structurées schema.org (Organization, WebSite, FAQPage, BlogPosting,
 *    Breadcrumb) injectées en JSON-LD.
 */

export const SITE_NAME = 'MedInfo AI';

/**
 * URL de prod par défaut : le domaine du site, servi par Hostinger (ADR-0038). Surchargée
 * par `EXPO_PUBLIC_APP_URL` (à poser AU BUILD) — utile pendant la recette sur le domaine
 * temporaire de Hostinger. Doit rester alignée sur la ligne `Sitemap:` de
 * `public/robots.txt` (verrouillé par test).
 */
export const DEFAULT_SITE_URL = 'https://medinfo-ai.com';

export const DEFAULT_DESCRIPTION =
  'Assistant IA d’information médicale en français : trois chatbots qui citent leurs sources (HAS, ANSM, ' +
  'PubMed), pour le grand public, les étudiants et les professionnels de santé.';

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
  return t.includes(SITE_NAME) ? t : `${t} | ${SITE_NAME}`;
}

// ─── Données structurées schema.org (JSON-LD) ───

export interface FaqItem {
  question: string;
  answer: string;
}

/** Logo carré de la marque (public/og-image.png) : logo de la fiche Organization. */
export function defaultOgImageUrl(): string {
  return canonicalUrl('/og-image.png');
}

/**
 * Carte de partage par défaut : 1200 × 630 (ratio 1,91:1 attendu par Open Graph, LinkedIn,
 * X/Twitter en grande carte), générée par `scripts/design/social-card.mjs` avec les polices,
 * la palette et la photo d'accueil du site. Le logo carré seul s'affichait en vignette.
 */
export const SOCIAL_CARD = {
  path: '/social-card.png',
  width: 1200,
  height: 630,
  type: 'image/png',
  alt: 'MedInfo AI : l’IA pour apprendre, des outils pour créer.',
} as const;

export function socialCardUrl(): string {
  return canonicalUrl(SOCIAL_CARD.path);
}

/**
 * Directives robots d'une page indexable : aperçu d'image en grand format (exigé par Google
 * Discover), extraits et aperçus vidéo sans limite de longueur.
 */
export const INDEXABLE_ROBOTS = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';

/**
 * Identifiants stables des entités (graphe schema.org) : le site, l'article ou l'outil
 * renvoient à LA même organisation au lieu d'en redéclarer une anonyme à chaque page.
 */
export function organizationId(): string {
  return `${siteUrl()}/#organization`;
}
export function webSiteId(): string {
  return `${siteUrl()}/#website`;
}

/** Référence courte à l'organisation (éditeur, auteur). */
function organizationRef(): Record<string, unknown> {
  return { '@type': 'Organization', '@id': organizationId(), name: SITE_NAME, url: `${siteUrl()}/` };
}

export function organizationJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': organizationId(),
    name: SITE_NAME,
    url: `${siteUrl()}/`,
    logo: defaultOgImageUrl(),
    description: DEFAULT_DESCRIPTION,
    // Nommé publiquement sur la page À propos (app/(marketing)/a-propos.tsx).
    founder: { '@type': 'Person', name: 'Hugo Bettembourg' },
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
    publisher: organizationRef(),
  };
}

export function webSiteJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': webSiteId(),
    name: SITE_NAME,
    url: `${siteUrl()}/`,
    inLanguage: 'fr-FR',
    publisher: { '@id': organizationId() },
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
  /** Dernière modification (`blog_posts.updated_at`) ; à défaut, la date de publication. */
  updatedAt?: string | null;
  category: string | null;
}

/**
 * Fiche BlogPosting. Le serveur produit la MÊME fiche dans le HTML servi aux robots sans
 * JavaScript (server/lib/blog-prerender.mjs, comparaison dans tests/unit/blog-prerender.test.ts).
 */
export function blogPostingJsonLd(post: BlogPostingSeo): Record<string, unknown> {
  const url = canonicalUrl(`/blog/${post.slug}`);
  const coverImage = post.coverImageUrl && /^https?:\/\//i.test(post.coverImageUrl.trim()) ? post.coverImageUrl.trim() : null;
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    inLanguage: 'fr-FR',
    // Image recommandée pour les résultats enrichis d'article : la couverture, sinon la carte du site.
    image: coverImage ?? socialCardUrl(),
    publisher: { ...organizationRef(), logo: { '@type': 'ImageObject', url: defaultOgImageUrl() } },
    author: organizationRef(),
  };
  if (post.summary) jsonLd.description = post.summary;
  if (post.publishedAt) jsonLd.datePublished = post.publishedAt;
  const modified = post.updatedAt ?? post.publishedAt;
  if (modified) jsonLd.dateModified = modified;
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
    title: 'MedInfo AI | Assistant IA d’information médicale',
    description:
      'Posez vos questions de santé à une IA qui peut rechercher et citer ses sources (HAS, ANSM, ' +
      'PubMed, sociétés savantes). Premier message gratuit, sans inscription.',
  },
  about: {
    path: '/a-propos',
    title: 'À propos de MedInfo AI',
    description:
      'Créé par un étudiant en médecine, MedInfo AI propose trois chatbots d’information médicale ' +
      'qui citent leurs sources et des outils pour étudiants et professionnels de santé.',
  },
  contact: {
    path: '/contact',
    title: 'Contact et assistance',
    description:
      'Écrivez à MedInfo AI : aide sur votre compte, presse et partenariats, exercice de vos ' +
      'droits RGPD. Réponse sous 48 h ouvrées.',
  },
  blog: {
    path: '/blog',
    title: 'Blog santé : articles d’information médicale',
    description:
      'Prévention, traitements, idées reçues : des articles d’information médicale générale, ' +
      'avec leurs sources, publiés par MedInfo AI.',
  },
  pricing: {
    path: '/pricing',
    title: 'Tarifs : offres grand public et étudiants',
    description:
      'Comparez les offres MedInfo AI : essai gratuit, abonnements grand public et étudiants. ' +
      'Les sources officielles (HAS, ANSM) restent gratuites pour tous.',
  },
  chat: {
    path: '/chat',
    title: 'Chat santé IA avec sources citées',
    description:
      'Chat IA médical en français : réponses claires appuyées sur des sources citées ' +
      '(HAS, ANSM, PubMed). Premier message gratuit, sans inscription.',
  },

  // ── Outils par feature (refonte SEO 2026-07) : chaque outil a son titre et sa
  //    description orientés intention de recherche, son canonical et sa fiche
  //    WebApplication — les écrans restent protégés par RoleGate côté produit. ──
  document: {
    path: '/document',
    title: 'Analyse de document médical par IA',
    description:
      "Déposez un compte rendu, une ordonnance ou un résultat d’analyse : l’IA l’explique " +
      'en langage clair. Le document lui-même n’est jamais conservé.',
  },
  ecos: {
    path: '/ecos',
    title: 'Simulation ECOS en ligne avec patient virtuel',
    description:
      'Entraînez-vous aux ECOS avec un patient simulé par IA : cas fictifs par spécialité, ' +
      'évaluation sur grille, note sur 20 et historique de vos passages.',
  },
  revision: {
    path: '/revision',
    title: 'Planning de révisions en médecine',
    description:
      "Construisez un planning de révisions réaliste pour vos partiels ou l’EDN : charge " +
      'quotidienne calculée, redistribution automatique, jauge de risque.',
  },
  partiel: {
    path: '/partiel',
    title: 'Analyse des partiels et classement de promo',
    description:
      'Importez les notes de votre promo (Excel, CSV, PDF) : rang, coefficients, points forts ' +
      'par z-score, distribution réelle et simulateur. Calcul 100 % local, aucune note envoyée.',
  },
  audio: {
    path: '/audio',
    title: 'Compte rendu de consultation par dictée vocale',
    description:
      'Dictez votre consultation : transcription puis compte rendu structuré par IA. Audio ' +
      'purgé sous 24 h, bibliothèque privée sécurisée, export PDF.',
  },
  presentation: {
    path: '/presentation',
    title: 'Générateur de présentations médicales (PPTX)',
    description:
      'Créez des présentations médicales à la main ou avec l’IA, puis exportez-les en PPTX ' +
      'compatible PowerPoint et Keynote. Sauvegarde en ligne incluse.',
  },
  cvBuilder: {
    path: '/cv-builder',
    title: 'Créateur de CV médical en ligne, export PDF',
    description:
      'Construisez un CV médical avec vos propres rubriques : aperçu A4 fidèle, ' +
      'relecture IA et export PDF au texte sélectionnable, lisible par les ' +
      'logiciels de tri des hôpitaux.',
  },
  article: {
    path: '/article',
    title: 'Rédaction d’article médical (IMRaD, Vancouver)',
    description:
      'Structurez votre manuscrit scientifique : gabarits IMRaD, compteurs par section, ' +
      'bibliographie DOI/PMID, citations Vancouver ou APA, export Word.',
  },
  scores: {
    path: '/scores',
    title: 'Scores médicaux et calculateurs cliniques',
    description:
      'Calculez les scores médicaux courants (CHA₂DS₂-VASc, Glasgow, CURB-65, CKD-EPI, MELD…) : ' +
      'boutons interactifs, interprétation immédiate, recherche par nom ou par fonction.',
  },

  // ── Pages légales : indexables, description honnête (confiance E-E-A-T). ──
  mentionsLegales: {
    path: '/mentions-legales',
    title: 'Mentions légales',
    description:
      'Éditeur, hébergement et contacts du site MedInfo AI : les informations prévues par ' +
      "la loi pour la confiance dans l’économie numérique (LCEN).",
  },
  cgu: {
    path: '/cgu',
    title: 'Conditions générales d’utilisation (CGU)',
    description:
      "Les règles d’utilisation de MedInfo AI : information médicale générale, comptes et " +
      'rôles vérifiés, abonnements, responsabilités et bon usage du service.',
  },
  confidentialite: {
    path: '/confidentialite',
    title: 'Politique de confidentialité (RGPD)',
    description:
      'Quelles données MedInfo AI traite, pourquoi et combien de temps : historique de chat ' +
      'privé, documents jamais stockés, droits RGPD et contact.',
  },
  legal: {
    path: '/legal',
    title: 'Informations légales et conformité',
    description:
      'Toutes les informations légales de MedInfo AI : mentions légales, CGU, politique de ' +
      "confidentialité et engagement de transparence sur l’IA (AI Act).",
  },
} as const satisfies Record<string, PageSeo>;

export type PageSeoKey = keyof typeof PAGE_SEO;
