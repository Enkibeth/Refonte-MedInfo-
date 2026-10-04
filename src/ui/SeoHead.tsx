/**
 * <SeoHead> — métadonnées de page (web uniquement, refonte SEO 2026-07).
 *
 * Rendues via expo-router/head : avec l'export web « server », elles sont présentes
 * dans le HTML servi (pas seulement injectées au runtime) → lisibles par les
 * crawlers. Sur natif, le composant ne rend rien (les balises n'y ont pas de sens).
 *
 * Source des contenus : src/seo/meta.ts (module pur, testé).
 */
import Head from 'expo-router/head';
import { Platform } from 'react-native';

import { DEFAULT_DESCRIPTION, INDEXABLE_ROBOTS, SOCIAL_CARD, canonicalUrl, pageTitle, SITE_NAME, socialCardUrl } from '@/seo/meta';

export function SeoHead({
  title,
  description = DEFAULT_DESCRIPTION,
  path,
  image,
  imageAlt,
  type = 'website',
  article,
  noindex = false,
  jsonLd,
}: {
  /** Titre court de la page (le suffixe « | MedInfo AI » est ajouté automatiquement). */
  title: string;
  description?: string;
  /** Chemin public (`/blog`, `/a-propos`…) — sert au canonical et à og:url. */
  path: string;
  /** Image de partage absolue (og:image) — optionnelle ; à défaut, la carte 1200 × 630 du site. */
  image?: string | null;
  /** Texte alternatif de l'image de partage fournie (ignoré pour la carte par défaut). */
  imageAlt?: string;
  type?: 'website' | 'article';
  /** Dates et rubrique d'un article (balises Open Graph `article:*`). */
  article?: { publishedTime?: string | null; modifiedTime?: string | null; section?: string | null };
  /** true pour exclure la page des moteurs (auth, compte, admin…). */
  noindex?: boolean;
  /** Données structurées schema.org, injectées en JSON-LD. */
  jsonLd?: Record<string, unknown>[];
}) {
  if (Platform.OS !== 'web') return null;

  const fullTitle = pageTitle(title);
  const url = canonicalUrl(path);
  // Image de partage : celle de la page (couverture d'article…) sinon la carte du site.
  // Ses dimensions ne sont déclarées que pour la carte : celles d'une image tierce sont inconnues.
  const ogImage = image ?? socialCardUrl();
  const ogImageAlt = image ? imageAlt ?? fullTitle : SOCIAL_CARD.alt;

  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {noindex ? <meta name="robots" content="noindex, nofollow" /> : <meta name="robots" content={INDEXABLE_ROBOTS} />}
      {noindex ? null : <link rel="canonical" href={url} />}

      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="fr_FR" />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:alt" content={ogImageAlt} />
      {image ? null : <meta property="og:image:type" content={SOCIAL_CARD.type} />}
      {image ? null : <meta property="og:image:width" content={String(SOCIAL_CARD.width)} />}
      {image ? null : <meta property="og:image:height" content={String(SOCIAL_CARD.height)} />}
      {article?.publishedTime ? <meta property="article:published_time" content={article.publishedTime} /> : null}
      {article?.modifiedTime ? <meta property="article:modified_time" content={article.modifiedTime} /> : null}
      {article?.section ? <meta property="article:section" content={article.section} /> : null}

      {/* Grande carte partout : couverture d'article ou carte 1200 × 630 du site. */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      <meta name="twitter:image:alt" content={ogImageAlt} />

      {/* JSON-LD : react-helmet (sous-jacent d'expo-router/head) n'émet le contenu
          d'un <script> que passé en enfant — dangerouslySetInnerHTML est ignoré. */}
      {(jsonLd ?? []).map((data, index) => (
        <script key={index} type="application/ld+json">
          {JSON.stringify(data)}
        </script>
      ))}
    </Head>
  );
}
