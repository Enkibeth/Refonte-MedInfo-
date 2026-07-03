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

import { DEFAULT_DESCRIPTION, canonicalUrl, pageTitle, SITE_NAME } from '@/seo/meta';

export function SeoHead({
  title,
  description = DEFAULT_DESCRIPTION,
  path,
  image,
  type = 'website',
  noindex = false,
  jsonLd,
}: {
  /** Titre court de la page (le suffixe « — MedInfo AI » est ajouté automatiquement). */
  title: string;
  description?: string;
  /** Chemin public (`/blog`, `/a-propos`…) — sert au canonical et à og:url. */
  path: string;
  /** Image de partage absolue (og:image) — optionnelle. */
  image?: string | null;
  type?: 'website' | 'article';
  /** true pour exclure la page des moteurs (auth, compte, admin…). */
  noindex?: boolean;
  /** Données structurées schema.org, injectées en JSON-LD. */
  jsonLd?: Record<string, unknown>[];
}) {
  if (Platform.OS !== 'web') return null;

  const fullTitle = pageTitle(title);
  const url = canonicalUrl(path);

  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <link rel="canonical" href={url} />
      )}

      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="fr_FR" />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      {image ? <meta property="og:image" content={image} /> : null}

      <meta name="twitter:card" content={image ? 'summary_large_image' : 'summary'} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      {image ? <meta name="twitter:image" content={image} /> : null}

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
