/**
 * Blog santé — liste publique des articles publiés (audit landing 2026-06).
 * Articles générés par IA depuis le panel admin (/api/admin/blog) puis publiés ;
 * la RLS ne montre ici que `status = 'published'` (migration 0022).
 */
import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

import { listPublishedPosts, type BlogPost } from '@/blog/posts';
import { PAGE_SEO, breadcrumbJsonLd } from '@/seo/meta';
import { LandingHeader } from '@/ui/LandingHeader';
import { Reveal } from '@/ui/Reveal';
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

export default function BlogScreen() {
  const router = useRouter();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void listPublishedPosts()
      .then((p) => setPosts(p))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={styles.screen}>
      <SeoHead
        title={PAGE_SEO.blog.title}
        description={PAGE_SEO.blog.description}
        path={PAGE_SEO.blog.path}
        jsonLd={[
          breadcrumbJsonLd([
            { name: 'Accueil', path: '/' },
            { name: 'Blog', path: PAGE_SEO.blog.path },
          ]),
        ]}
      />
      <LandingHeader />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.inner}>
          <Reveal>
            <Text style={styles.eyebrow}>Blog</Text>
            <Text style={styles.title}>Comprendre la santé, un article à la fois.</Text>
            <Text style={styles.lead}>
              Prévention, recherche, idées reçues : des articles d'information générale, sourcés
              et relus. Jamais un avis médical individuel.
            </Text>
          </Reveal>

          {loading ? (
            <View style={styles.grid}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={styles.cell}>
                  <Skeleton height={300} radius={tokens.radius.lg} />
                </View>
              ))}
            </View>
          ) : posts.length === 0 ? (
            <Reveal>
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Les premiers articles arrivent bientôt</Text>
                <Text style={styles.emptyText}>
                  En attendant, posez vos questions directement au chat MedInfo AI : le premier
                  message est sans inscription.
                </Text>
              </View>
            </Reveal>
          ) : (
            <View style={styles.grid}>
              {posts.map((p, i) => (
                <Reveal key={p.id} delay={tokens.motion.revealStagger * (i % 3)} style={styles.cell}>
                  <TouchableOpacity
                    style={styles.card}
                    onPress={() => router.push(`/(marketing)/blog/${p.slug}` as never)}
                    accessibilityRole="button"
                    accessibilityLabel={`Lire l'article : ${p.title}`}
                  >
                    {p.cover_image_url ? (
                      <Image source={{ uri: p.cover_image_url }} style={styles.cover} resizeMode="cover" />
                    ) : (
                      <View style={styles.coverFallback}>
                        <Text style={styles.coverFallbackText}>{p.category ?? 'Santé'}</Text>
                      </View>
                    )}
                    <View style={styles.cardBody}>
                      <View style={styles.metaRow}>
                        {p.category ? (
                          <View style={styles.categoryPill}>
                            <Text style={styles.categoryText}>{p.category}</Text>
                          </View>
                        ) : null}
                        <Text style={styles.date}>{formatDate(p.published_at)}</Text>
                      </View>
                      <Text style={styles.cardTitle} numberOfLines={3}>
                        {p.title}
                      </Text>
                      {p.summary ? (
                        <Text style={styles.cardSummary} numberOfLines={3}>
                          {p.summary}
                        </Text>
                      ) : null}
                      <Text style={styles.readMore}>Lire l'article →</Text>
                    </View>
                  </TouchableOpacity>
                </Reveal>
              ))}
            </View>
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
    maxWidth: 960,
    paddingHorizontal: tokens.space.xl,
    paddingTop: tokens.space['2xl'],
    gap: tokens.space.xl,
  },
  eyebrow: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentVivid,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
    letterSpacing: tokens.tracking.capsWide,
    textTransform: 'uppercase',
    marginBottom: tokens.space.sm,
  },
  title: {
    fontFamily: tokens.font.serif,
    color: tokens.colors.text,
    fontSize: tokens.type.display.fontSize,
    lineHeight: tokens.type.display.lineHeight,
    letterSpacing: tokens.type.display.letterSpacing,
    fontWeight: tokens.weight.semibold,
  },
  lead: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.bodyLg.fontSize,
    lineHeight: tokens.type.bodyLg.lineHeight,
    marginTop: tokens.space.sm,
    maxWidth: 620,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.lg },
  cell: { flexGrow: 1, flexBasis: 280, maxWidth: 460 },
  card: {
    flex: 1,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    overflow: 'hidden',
    ...tokens.elevation.sm,
    ...tokens.motion.transitionWeb,
  },
  cover: { width: '100%', height: 160, backgroundColor: tokens.colors.surfaceAlt },
  coverFallback: {
    width: '100%',
    height: 160,
    backgroundColor: tokens.colors.accentDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverFallbackText: {
    fontFamily: tokens.font.serif,
    color: tokens.colors.onAccent,
    fontSize: tokens.type.h2.fontSize,
    fontWeight: tokens.weight.semibold,
    opacity: 0.85,
  },
  cardBody: { padding: tokens.space.lg, gap: tokens.space.sm },
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
  cardTitle: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    lineHeight: tokens.type.h3.lineHeight,
    letterSpacing: tokens.type.h3.letterSpacing,
    fontWeight: tokens.weight.bold,
  },
  cardSummary: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.label.fontSize,
    lineHeight: tokens.type.label.lineHeight,
  },
  readMore: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentVivid,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
    marginTop: tokens.space.xs,
  },
  emptyCard: {
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: tokens.space['2xl'],
    gap: tokens.space.sm,
    alignItems: 'flex-start',
  },
  emptyTitle: {
    fontFamily: tokens.font.serif,
    color: tokens.colors.text,
    fontSize: tokens.type.h2.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  emptyText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    maxWidth: 480,
  },
});
