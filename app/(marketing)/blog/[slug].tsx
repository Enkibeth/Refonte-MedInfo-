/**
 * Article de blog — page publique avec sommaire cliquable (audit landing 2026-06).
 *
 * Le contenu markdown est découpé en sections `## ` (src/blog/toc.ts, module pur) ;
 * chaque section mesure sa position (onLayout) et le sommaire fait défiler le
 * ScrollView vers la section choisie.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { getPostBySlug, type BlogPost } from '@/blog/posts';
import { splitArticleSections } from '@/blog/toc';
import { PAGE_SEO, blogPostingJsonLd, breadcrumbJsonLd } from '@/seo/meta';
import { LandingHeader } from '@/ui/LandingHeader';
import { MarkdownRenderer } from '@/ui/MarkdownRenderer';
import { Icon } from '@/ui/icons';
import { SeoHead } from '@/ui/SeoHead';
import { SiteFooter } from '@/ui/SiteFooter';
import { Skeleton } from '@/ui/Skeleton';
import { tokens } from '@/ui/tokens';

function formatDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
}

export default function BlogArticleScreen() {
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const router = useRouter();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  const scrollRef = useRef<ScrollView>(null);
  const sectionYRef = useRef<Record<number, number>>({});

  useEffect(() => {
    if (!slug) return;
    void getPostBySlug(String(slug))
      .then((p) => setPost(p))
      .catch(() => setPost(null))
      .finally(() => setLoading(false));
  }, [slug]);

  const sections = useMemo(
    () => (post ? splitArticleSections(post.content_md) : []),
    [post],
  );
  const tocEntries = sections
    .map((s, index) => ({ heading: s.heading, index }))
    .filter((e): e is { heading: string; index: number } => Boolean(e.heading));

  const scrollToSection = (index: number) => {
    const y = sectionYRef.current[index];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
  };

  return (
    <View style={styles.screen}>
      {post ? (
        <SeoHead
          title={post.title}
          description={post.summary ?? PAGE_SEO.blog.description}
          path={`/blog/${post.slug}`}
          image={post.cover_image_url}
          type="article"
          jsonLd={[
            blogPostingJsonLd({
              slug: post.slug,
              title: post.title,
              summary: post.summary,
              coverImageUrl: post.cover_image_url,
              publishedAt: post.published_at,
              category: post.category,
            }),
            breadcrumbJsonLd([
              { name: 'Accueil', path: '/' },
              { name: 'Blog', path: PAGE_SEO.blog.path },
              { name: post.title, path: `/blog/${post.slug}` },
            ]),
          ]}
        />
      ) : null}
      <LandingHeader />
      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.inner}>
          <TouchableOpacity
            style={styles.backLink}
            onPress={() => router.push('/(marketing)/blog' as never)}
            accessibilityRole="link"
            accessibilityLabel="Retour au blog"
          >
            <View style={{ transform: [{ rotate: '180deg' }] }}>
              <Icon name="arrowRight" size={14} color={tokens.colors.accentVivid} />
            </View>
            <Text style={styles.backLinkText}>Tous les articles</Text>
          </TouchableOpacity>

          {loading ? (
            <View style={{ gap: tokens.space.lg }}>
              <Skeleton height={220} radius={tokens.radius.lg} />
              <Skeleton height={34} width={'80%'} />
              <Skeleton height={16} width={'60%'} />
              <Skeleton height={16} />
              <Skeleton height={16} />
            </View>
          ) : !post ? (
            <View style={styles.missingCard}>
              <Text style={styles.missingTitle}>Article introuvable</Text>
              <Text style={styles.missingText}>
                Cet article n'existe pas ou n'est plus publié.
              </Text>
            </View>
          ) : (
            <>
              {post.cover_image_url ? (
                <Image source={{ uri: post.cover_image_url }} style={styles.cover} resizeMode="cover" />
              ) : null}

              <View style={styles.metaRow}>
                {post.category ? (
                  <View style={styles.categoryPill}>
                    <Text style={styles.categoryText}>{post.category}</Text>
                  </View>
                ) : null}
                <Text style={styles.date}>{formatDate(post.published_at)}</Text>
              </View>
              <Text style={styles.title}>{post.title}</Text>
              {post.summary ? <Text style={styles.summary}>{post.summary}</Text> : null}

              {tocEntries.length > 1 ? (
                <View style={styles.tocCard}>
                  <Text style={styles.tocTitle}>Sommaire</Text>
                  {tocEntries.map((e, i) => (
                    <TouchableOpacity
                      key={e.index}
                      style={styles.tocRow}
                      onPress={() => scrollToSection(e.index)}
                      accessibilityRole="button"
                      accessibilityLabel={`Aller à la section : ${e.heading}`}
                    >
                      <Text style={styles.tocIndex}>{String(i + 1).padStart(2, '0')}</Text>
                      <Text style={styles.tocText}>{e.heading}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              {sections.map((s, index) => (
                <View
                  key={index}
                  onLayout={(ev) => {
                    sectionYRef.current[index] = ev.nativeEvent.layout.y;
                  }}
                  style={styles.section}
                >
                  {s.heading ? <Text style={styles.sectionHeading}>{s.heading}</Text> : null}
                  {s.markdown ? <MarkdownRenderer text={s.markdown} /> : null}
                </View>
              ))}
            </>
          )}
        </View>
        <View style={styles.footerSpacer} />
        <SiteFooter />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.colors.background },
  scroll: { flex: 1 },
  content: { flexGrow: 1, alignItems: 'center' },
  footerSpacer: { height: tokens.space['3xl'] },
  inner: {
    width: '100%',
    maxWidth: 720,
    paddingHorizontal: tokens.space.xl,
    paddingTop: tokens.space.xl,
    gap: tokens.space.lg,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    alignSelf: 'flex-start',
  },
  backLinkText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentVivid,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  cover: {
    width: '100%',
    height: 260,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.surfaceAlt,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm, flexWrap: 'wrap' },
  categoryPill: {
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.accentSurface,
    paddingHorizontal: tokens.space.sm,
    paddingVertical: 2,
  },
  categoryText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  date: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, fontSize: tokens.type.caption.fontSize },
  title: {
    fontFamily: tokens.font.serif,
    color: tokens.colors.text,
    fontSize: tokens.type.display.fontSize,
    lineHeight: tokens.type.display.lineHeight,
    letterSpacing: tokens.type.display.letterSpacing,
    fontWeight: tokens.weight.semibold,
  },
  summary: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.bodyLg.fontSize,
    lineHeight: tokens.type.bodyLg.lineHeight,
  },
  tocCard: {
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.accentSurface,
    borderWidth: 1,
    borderColor: tokens.colors.accentSurfaceStrong,
    padding: tokens.space.lg,
    gap: tokens.space.xs,
  },
  tocTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: tokens.tracking.caps,
    marginBottom: tokens.space.xs,
  },
  tocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    paddingVertical: tokens.space.xs + 2,
  },
  tocIndex: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.accentVivid,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.bold,
  },
  tocText: {
    flex: 1,
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.medium,
  },
  section: { gap: tokens.space.sm },
  sectionHeading: {
    fontFamily: tokens.font.serif,
    color: tokens.colors.text,
    fontSize: tokens.type.h2.fontSize,
    lineHeight: tokens.type.h2.lineHeight,
    letterSpacing: tokens.type.h2.letterSpacing,
    fontWeight: tokens.weight.semibold,
    marginTop: tokens.space.md,
  },
  missingCard: {
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: tokens.space['2xl'],
    gap: tokens.space.sm,
  },
  missingTitle: {
    fontFamily: tokens.font.serif,
    color: tokens.colors.text,
    fontSize: tokens.type.h2.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  missingText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.body.fontSize,
  },
});
