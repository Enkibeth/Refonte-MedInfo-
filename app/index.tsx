import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/auth/AuthProvider';
import { isAdminUserId } from '@/admin/index';
import type { Persona } from '@/ai/prompts/_schema';
import { isFeatureVisible, type AppFeatureMeta } from '@/ai/routing/featureVisibility';
import { getAiDisclosure } from '@/compliance/disclosures';
import { PAGE_SEO, faqPageJsonLd, organizationJsonLd, webSiteJsonLd } from '@/seo/meta';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/icons';
import { LandingHeader } from '@/ui/LandingHeader';
import { MainContent } from '@/ui/landmarks';
import { LandingPhoto } from '@/ui/LandingPhoto';
import { AccessMatrix } from '@/ui/landing/AccessMatrix';
import { AudienceSwitcher, SectionLabel } from '@/ui/landing/AudienceSwitcher';
import { CLOSING_COPY, FAQ_ITEMS, HERO_COPY } from '@/ui/landing/copy';
import { HeroTrace } from '@/ui/landing/HeroTrace';
import { LandingStyle } from '@/ui/landing/LandingStyle';
import { lx } from '@/ui/landing/lx';
import { MethodSection } from '@/ui/landing/MethodSection';
import { ReadingCard } from '@/ui/landing/ReadingCard';
import { Showcase } from '@/ui/landing/Showcase';
import { useHeroMotion } from '@/ui/landing/useHeroMotion';
import { SeoHead } from '@/ui/SeoHead';
import { SiteFooter } from '@/ui/SiteFooter';
import { tokens } from '@/ui/tokens';

/**
 * Accueil — direction « Moniteur » (refonte créative 2026-10, ADR-0047).
 *
 * Un premier écran bleu nuit sur papier millimétré d'ECG : grand titre en serif, tracé balayé
 * comme sur un moniteur et ramifié en trois pistes (les trois assistants), photographie
 * révélée par la barre de balayage, carte « trois lectures ». Puis, en alternant clair et
 * sombre : les trois assistants (onglets), les outils en défilement narratif, la matrice des
 * accès, la méthode de réponse, les questions fréquentes et l'appel final.
 *
 * Pré-rendu sans fenêtre : les styles JS valent la mise en page compacte ; le CSS de
 * l'accueil (src/ui/landing/landingCss.ts) porte les plages plus larges et le mouvement.
 * Mentions réglementaires inchangées : disclosure IA canonique, 15/112 dans la FAQ, pied.
 */
export default function HomeScreen() {
  const router = useRouter();
  const { user, persona } = useSession();
  const [paused, setPaused] = useState(false);
  const heroRef = useHeroMotion<View>();
  const isAdmin = user ? isAdminUserId(user.id) : false;
  const canSwitch = isAdmin || persona === 'student' || persona === 'professional';
  // Visiteur : les trois chatbots en essai d'un message ; compte public : le chat public seul.
  const canOpen = (id: Persona) => !user || canSwitch || id === 'public';
  // Outil ouvert au compte courant (même règle que la navigation) ; visiteur : `null`.
  const canUseTool = user ? (feature: AppFeatureMeta) => isFeatureVisible(feature.id, persona, { isAdmin }) : null;

  return <View style={styles.screen}>
    <SeoHead title={PAGE_SEO.home.title} description={PAGE_SEO.home.description} path={PAGE_SEO.home.path} jsonLd={[organizationJsonLd(), webSiteJsonLd(), faqPageJsonLd(FAQ_ITEMS)]} />
    <LandingStyle />
    <LandingHeader />
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <MainContent {...lx(['lx', 'landing-page', paused && 'lx-paused'])}>
        {/* ── Premier écran : le moniteur ── */}
        <View ref={heroRef} {...lx('lx-hero')} style={styles.hero}>
          <View {...lx('lx-hero-bg')} aria-hidden style={styles.heroBg} />
          <View {...lx('lx-container')} style={styles.page}>
            <View style={styles.kickerRow}>
              <View style={styles.kicker}>
                <View style={styles.kickerRule} />
                <Text style={styles.kickerText}>{HERO_COPY.kicker}</Text>
                <Text {...lx('ge640')} style={styles.kickerDetail}>{HERO_COPY.kickerDetail}</Text>
              </View>
              <View style={styles.monitor}>
                <Text {...lx('ge768')} aria-hidden style={styles.readout}>{HERO_COPY.readout}</Text>
                {Platform.OS === 'web' ? (
                  <Pressable
                    {...lx('lx-pause')}
                    accessibilityRole="button"
                    onPress={() => setPaused((p) => !p)}
                    aria-pressed={paused}
                    accessibilityLabel={paused ? 'Reprendre les animations de la page' : 'Figer les animations de la page'}
                    style={({ hovered, focused }: { hovered?: boolean; focused?: boolean }) => [styles.pause, hovered && styles.pauseHover, focused && tokens.focus.ring]}
                  >
                    <Icon name={paused ? 'play' : 'pause'} size={14} color={tokens.colors.night.text} />
                    <Text style={styles.pauseText}>{paused ? 'Reprendre' : 'Figer'}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            <Text {...lx('lx-h1')} accessibilityRole="header" aria-level={1} style={styles.headline}>
              <Words groups={HERO_COPY.line1} start={0} />
              {'\n'}
              <Text style={styles.headlineAccent}><Words groups={HERO_COPY.line2} start={4} /></Text>
            </Text>
          </View>

          <View {...lx('lx-trace-band')} style={styles.traceBand}>
            <HeroTrace />
          </View>

          <View {...lx('lx-container')} style={styles.page}>
            <View {...lx('lx-hero-row')} style={styles.heroRow}>
              <View {...lx('lx-hero-copy')} style={styles.heroCopy}>
                <Text {...lx(['lx-in'], { d: '1' })} style={styles.subhead}>{HERO_COPY.subhead}</Text>
                <View {...lx(['lx-in', 'landing-actions'], { d: '2' })} style={styles.actions}>
                  <Button label={user ? 'Ouvrir le chat' : 'Essayer sans inscription'} onPress={() => router.push('/(chat)/chat')} accessibilityRole="link" />
                  <Button label={user ? 'Mon espace' : 'Se connecter'} variant="outlineLight" onPress={() => router.push(user ? '/(chat)/dashboard' : '/(auth)/sign-in')} accessibilityRole="link" />
                </View>
                {!user ? <Text {...lx(['lx-in'], { d: '3' })} style={styles.meta}>{HERO_COPY.meta}</Text> : null}
                <Text {...lx(['lx-in'], { d: '3' })} style={styles.disclosure}>{getAiDisclosure()}</Text>
              </View>
              <View {...lx('lx-hero-visual')} style={styles.heroVisual}>
                <View {...lx('lx-sweep')} style={styles.heroPhoto}>
                  <LandingPhoto photo="study" priority aspectRatio={4 / 3} radius={tokens.radius.xl + 4} position="50% 30%" sizes="(min-width: 1200px) 600px, (min-width: 1024px) 50vw, calc(100vw - 32px)" />
                </View>
                <View {...lx('lx-card-slot')} style={styles.cardSlot}>
                  <ReadingCard />
                </View>
              </View>
            </View>
          </View>
        </View>

        <AudienceSwitcher canOpen={canOpen} canUseTool={canUseTool} isAuthed={!!user} />
        <Showcase />
        <AccessMatrix canUse={canUseTool} />
        <MethodSection />

        {/* ── Questions fréquentes (miroir exact du JSON-LD FAQPage) ── */}
        <View style={styles.faqBand}>
          <View {...lx('lx-container')} style={styles.page}>
            <View {...lx('lx-faq-cols')} style={styles.faqCols}>
              <View {...lx('lx-faq-head')} style={styles.faqHead}>
                <SectionLabel index="05" label="Avant de commencer" />
                <Text accessibilityRole="header" aria-level={2} style={styles.sectionTitle}>Questions fréquentes</Text>
                <Text style={styles.faqIntro}>En cas d’urgence, composez le 15 (SAMU) ou le 112. MedInfo AI ne remplace ni une consultation ni un avis médical.</Text>
              </View>
              <View style={styles.faqList}>{FAQ_ITEMS.map((item, i) => <View {...lx('lx-faq')} key={item.question} style={styles.faq}>
                <View style={styles.faqQuestion}>
                  <Text style={styles.faqNumber} aria-hidden>{String(i + 1).padStart(2, '0')}</Text>
                  <Text accessibilityRole="header" aria-level={3} style={styles.faqQuestionText}>{item.question}</Text>
                </View>
                <Text style={styles.faqAnswer}>{item.answer}</Text>
              </View>)}</View>
            </View>
          </View>
        </View>

        {/* ── Appel final ── */}
        <View {...lx('lx-closing')} style={styles.closing}>
          <View {...lx('lx-closing-trace')} aria-hidden style={styles.closingTrace} />
          <View {...lx('lx-container')} style={styles.page}>
            <View {...lx('lx-closing-row')} style={styles.closingRow}>
              <Text {...lx('lx-closing-title')} accessibilityRole="header" aria-level={2} style={styles.closingTitle}>{CLOSING_COPY.title}</Text>
              <View style={styles.closingSide}>
                <Text style={styles.closingText}>{CLOSING_COPY.text}</Text>
                <View {...lx('landing-actions')} style={styles.actions}>
                  <Button label={user ? 'Ouvrir le chat' : 'Essayer sans inscription'} variant="inverse" onPress={() => router.push('/(chat)/chat')} accessibilityRole="link" />
                  {!user ? <Button label="Se connecter" variant="outlineLight" onPress={() => router.push('/(auth)/sign-in')} accessibilityRole="link" /> : null}
                </View>
              </View>
            </View>
          </View>
        </View>
      </MainContent>
      <SiteFooter />
    </ScrollView>
  </View>;
}

/**
 * Mots du grand titre : chacun monte de sous un cache, en décalé (web, CSS seul). Les mots
 * vont par groupes insécables (« de santé, ») : la ligne ne se coupe qu'entre deux groupes.
 */
function Words({ groups, start }: { groups: readonly (readonly string[])[]; start: number }) {
  let rank = start;
  return <>{groups.map((group, g) => <Text key={g}>
    <Text {...lx('lx-nw')}>{group.map((word, i) => {
      const d = rank++;
      return <Text key={word}>
        <Text {...lx('lx-w')}><Text {...lx('lx-wi', { d: String(d) })}>{word}</Text></Text>
        {i < group.length - 1 ? ' ' : ''}
      </Text>;
    })}</Text>
    {g < groups.length - 1 ? ' ' : ''}
  </Text>)}</>;
}

const night = tokens.colors.night;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.colors.background },
  content: { flexGrow: 1 },
  page: { width: '100%', maxWidth: tokens.layout.page, alignSelf: 'center', paddingHorizontal: tokens.space.lg },

  hero: { position: 'relative', backgroundColor: night.base, paddingTop: tokens.space['2xl'], paddingBottom: tokens.space['3xl'], zIndex: 1 },
  heroBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  kickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: tokens.space.md, marginBottom: tokens.space.xl },
  kicker: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: tokens.space.sm, flexShrink: 1 },
  kickerRule: { width: 24, height: 2, backgroundColor: night.mint },
  kickerText: { fontFamily: tokens.font.display, color: night.text, ...tokens.type.label, fontWeight: tokens.weight.semibold },
  kickerDetail: { fontFamily: tokens.font.sans, color: night.muted, ...tokens.type.label },
  monitor: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.md, flexShrink: 0 },
  readout: { fontFamily: tokens.font.mono, color: night.muted, fontSize: 12, lineHeight: 16, fontVariant: ['tabular-nums'] },
  pause: { minHeight: tokens.size.controlMd, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: tokens.space.md, borderRadius: tokens.radius.pill, borderWidth: tokens.border.thin, borderColor: night.line, ...tokens.motion.transitionWeb },
  pauseHover: { backgroundColor: tokens.colors.onDarkHover },
  pauseText: { fontFamily: tokens.font.display, color: night.text, ...tokens.type.caption, fontWeight: tokens.weight.semibold },
  headline: { fontFamily: tokens.font.serif, color: night.text, ...tokens.type.hero, fontWeight: tokens.weight.regular },
  headlineAccent: { fontStyle: 'italic', color: night.mint },
  traceBand: { width: '100%', marginTop: tokens.space.lg, marginBottom: tokens.space.xl },
  heroRow: { gap: tokens.space['2xl'] },
  heroCopy: { gap: tokens.space.lg },
  subhead: { fontFamily: tokens.font.sans, color: night.muted, ...tokens.type.bodyLg, maxWidth: tokens.layout.form },
  actions: { flexDirection: 'column', alignItems: 'stretch', gap: tokens.space.md },
  meta: { fontFamily: tokens.font.sans, color: night.muted, ...tokens.type.caption },
  disclosure: { fontFamily: tokens.font.sans, color: night.muted, ...tokens.type.caption, borderLeftWidth: 2, borderLeftColor: night.mint, paddingLeft: tokens.space.md, maxWidth: tokens.layout.form },
  heroVisual: { position: 'relative' },
  heroPhoto: { width: '100%' },
  cardSlot: { marginTop: -56, paddingHorizontal: tokens.space.md },

  faqBand: { backgroundColor: tokens.colors.background, paddingVertical: tokens.space['3xl'] },
  faqCols: { gap: tokens.space['2xl'] },
  faqHead: { gap: tokens.space.md },
  sectionTitle: { fontFamily: tokens.font.serif, color: tokens.colors.text, ...tokens.type.display, fontWeight: tokens.weight.regular },
  faqIntro: { fontFamily: tokens.font.sans, color: tokens.colors.textSubtle, ...tokens.type.body, maxWidth: 380 },
  faqList: { flex: 1 },
  faq: { paddingVertical: tokens.space.xl, gap: tokens.space.md, borderTopWidth: tokens.border.thin, borderTopColor: tokens.colors.border },
  faqQuestion: { flexDirection: 'row', alignItems: 'baseline', gap: tokens.space.md },
  faqNumber: { fontFamily: tokens.font.serif, fontStyle: 'italic', color: tokens.colors.accent, fontSize: 18, lineHeight: 24, minWidth: 26 },
  faqQuestionText: { flex: 1, fontFamily: tokens.font.display, color: tokens.colors.text, ...tokens.type.h3, fontWeight: tokens.weight.semibold },
  faqAnswer: { fontFamily: tokens.font.sans, color: tokens.colors.textSubtle, ...tokens.type.body, paddingLeft: 26 + tokens.space.md, maxWidth: tokens.layout.measure + 40 },

  closing: { position: 'relative', overflow: 'hidden', backgroundColor: tokens.colors.accentVivid, paddingVertical: tokens.space['3xl'] + tokens.space.lg },
  closingTrace: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  closingRow: { gap: tokens.space.xl },
  closingTitle: { fontFamily: tokens.font.serif, color: tokens.colors.onAccent, ...tokens.type.display, fontWeight: tokens.weight.regular },
  closingSide: { gap: tokens.space.lg },
  closingText: { fontFamily: tokens.font.sans, color: tokens.colors.onAccent, ...tokens.type.bodyLg, maxWidth: 420 },
});
