import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/auth/AuthProvider';
import { isAdminUserId } from '@/admin/index';
import type { Persona } from '@/ai/prompts/_schema';
import { APP_FEATURES, visibleFeatures } from '@/ai/routing/featureVisibility';
import { getAiDisclosure } from '@/compliance/disclosures';
import { PAGE_SEO, faqPageJsonLd, organizationJsonLd, webSiteJsonLd, type FaqItem } from '@/seo/meta';
import { Button } from '@/ui/Button';
import { EcgTrace } from '@/ui/EcgTrace';
import { Icon, type IconName } from '@/ui/icons';
import { LandingHeader } from '@/ui/LandingHeader';
import { MainContent } from '@/ui/landmarks';
import { LandingPhoto } from '@/ui/LandingPhoto';
import { SeoHead } from '@/ui/SeoHead';
import { SiteFooter } from '@/ui/SiteFooter';
import { tokens } from '@/ui/tokens';
import { featureTint } from '@/ui/featureChips';
import { mi } from '@/ui/responsive';
import { useWindowWidth } from '@/ui/useWindowWidth';

const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'MedInfo AI est-il gratuit ?',
    answer:
      'Oui pour commencer : le premier message est gratuit, sans inscription, sur les trois chatbots. ' +
      'Un compte gratuit permet de continuer ; un abonnement lève seulement la limite de messages. ' +
      'Les sources officielles (HAS, ANSM…) restent gratuites pour tous.',
  },
  {
    question: 'MedInfo AI remplace-t-il un médecin ou un pharmacien ?',
    answer:
      "Non. MedInfo AI fournit de l'information médicale générale, jamais un diagnostic ni un avis " +
      "individuel. En cas de symptôme inquiétant, consultez un professionnel de santé ; en cas d'urgence, " +
      'composez le 15 (SAMU) ou le 112.',
  },
  {
    question: 'D’où viennent les réponses ?',
    answer:
      "Selon le mode choisi, l’assistant peut rechercher sur Internet des recommandations et des publications médicales. " +
      'Les références citées permettent de consulter les documents d’origine. Vérifiez leur date, leur contexte et leur niveau de preuve.',
  },
  {
    question: 'Quelle différence entre les trois chatbots ?',
    answer:
      'Le chat grand public explique sans jargon ; le chat étudiant s’appuie sur les référentiels des ' +
      'Collèges (EDN/R2C) ; le chat professionnel propose une synthèse de la littérature et des recommandations. ' +
      'Les comptes étudiants et professionnels vérifiés accèdent aux trois.',
  },
  {
    question: 'Quels outils au-delà du chat ?',
    answer:
      'Analyse de document médical (grand public), simulation ECOS, planning de révisions et analyse ' +
      'des partiels (étudiants), compte rendu de consultation dicté (professionnels), générateur de ' +
      'présentations, créateur de CV, rédaction d’article et scores cliniques (étudiants et professionnels).',
  },
  {
    question: 'Mes conversations sont-elles privées ?',
    answer:
      'Oui : votre historique de conversations n’est visible que par vous (isolation stricte par compte) ' +
      'et vous pouvez l’exporter en PDF ou le supprimer. Les documents analysés ne sont jamais stockés.',
  },
];

const AUDIENCES: { id: Persona; label: string; title: string; description: string; icon: IconName }[] = [
  { id: 'public', label: 'Grand public', title: 'Comprendre une information de santé', description: 'Les sujets de santé expliqués sans jargon.', icon: 'users' },
  { id: 'student', label: 'Étudiants en santé', title: 'Réviser les cours et le raisonnement clinique', description: 'Des réponses appuyées sur les référentiels des Collèges (EDN/R2C).', icon: 'bookOpen' },
  { id: 'professional', label: 'Professionnels de santé', title: 'Explorer la littérature médicale', description: 'Une synthèse des recommandations et de la littérature, références à l’appui.', icon: 'stethoscope' },
];

const AUDIENCE_COLORS = {
  public: tokens.colors.personas.public,
  student: tokens.colors.personas.student,
  professional: tokens.colors.personas.pro,
};

const TRUST_ITEMS = [
  ['Des modèles d’IA récents', 'MedInfo AI associe des modèles d’OpenAI et d’Anthropic, choisis selon la tâche. Le chat fonctionne aujourd’hui avec GPT-6 Luna.'],
  ['Des outils de travail', 'Simulations ECOS, planning de révisions, présentations, CV et rédaction d’articles, accessibles selon votre profil.'],
  ['Des références consultables', 'Les documents cités s’ouvrent depuis la réponse, avec leur type de source, pour poursuivre votre lecture.'],
] as const;

export default function HomeScreen() {
  const router = useRouter();
  const { user, persona } = useSession();
  const width = useWindowWidth();
  const wide = width >= tokens.layout.shell;
  const compact = width < tokens.layout.compact;
  const isAdmin = user ? isAdminUserId(user.id) : false;
  const canSwitch = isAdmin || persona === 'student' || persona === 'professional';
  const audiences = user && !canSwitch ? AUDIENCES.filter(p => p.id === 'public') : AUDIENCES;
  const features = (user ? visibleFeatures(persona, { isAdmin }) : APP_FEATURES).filter(f => f.id !== 'chat');
  return <View style={styles.screen}>
    <SeoHead title={PAGE_SEO.home.title} description={PAGE_SEO.home.description} path={PAGE_SEO.home.path} jsonLd={[organizationJsonLd(), webSiteJsonLd(), faqPageJsonLd(FAQ_ITEMS)]} />
    <LandingHeader />
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <MainContent {...mi('landing-page')}>
        <View style={styles.heroBand}>
          <View {...mi('landing-container')} style={[styles.page, compact && styles.pageCompact]}>
            <View {...mi('landing-hero')} style={[styles.hero, wide && styles.heroWide]}>
              <View style={styles.intro}>
                <View style={styles.eyebrow}>
                  <View style={styles.eyebrowRule} aria-hidden />
                  <Text style={styles.kicker}>MedInfo AI · Information médicale générale</Text>
                </View>
                <Text {...mi('landing-headline')} accessibilityRole="header" aria-level={1} style={[styles.headline, !wide && styles.headlineCompact]}>L’IA pour apprendre.{'\n'}<Text style={styles.headlineAccent}>Des outils pour créer.</Text></Text>
                <Text style={styles.subhead}>Trois assistants d’information médicale et des outils de travail : simulation ECOS, planning de révisions, présentations, CV et articles.</Text>
                <View style={styles.highlights}>
                  <Text style={styles.highlight}>3 assistants</Text>
                  <Text style={styles.highlight}>ECOS et révisions</Text>
                  <Text style={styles.highlight}>Documents et créations</Text>
                </View>
                <View {...mi('landing-actions')} style={[styles.heroActions, compact && styles.actionsCompact]}>
                  <Button label={user ? 'Ouvrir le chat' : 'Essayer sans inscription'} onPress={() => router.push('/(chat)/chat')} fullWidth={compact} />
                  <Button label={user ? 'Mon espace' : 'Se connecter'} variant="ghost" onPress={() => router.push(user ? '/(chat)/dashboard' : '/(auth)/sign-in')} fullWidth={compact} />
                </View>
                {!user ? <Text style={styles.meta}>Un premier message gratuit, sans créer de compte.</Text> : null}
                <Text style={styles.disclosure}>{getAiDisclosure()}</Text>
              </View>
              <View {...mi('landing-hero-photo')} style={[styles.heroVisual, wide && styles.heroVisualWide]}>
                <View style={styles.photoMount}>
                  <View style={styles.photoTopline}>
                    <Text style={styles.photoLabel}>Pour les étudiants en santé</Text>
                    <Icon name="bookOpen" size={tokens.size.iconMd} color={tokens.colors.personas.student.accent} />
                  </View>
                  <View {...mi('landing-photo-image')}>
                    <LandingPhoto photo="study" priority aspectRatio={3 / 2} sizes="(min-width: 1200px) 512px, (min-width: 1024px) calc((100vw - 144px) / 2), (min-width: 640px) calc(100vw - 80px), calc(100vw - 64px)" />
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>
        <View {...mi('landing-container')} style={[styles.page, compact && styles.pageCompact]}>
          {/* Signature visuelle historique : tracé ECG qui se dessine en boucle (web seulement). */}
          <EcgTrace />
          <View style={styles.audiencesSection}>
            <Text accessibilityRole="header" aria-level={2} style={styles.label}>Trois espaces de conversation</Text>
            <View {...mi('landing-audiences')} style={[styles.audiences, wide && styles.audiencesWide]}>
              {audiences.map((a) => {
                const color = AUDIENCE_COLORS[a.id];
                return <Pressable {...mi('landing-audience')} key={a.id} onPress={() => router.push(`/(chat)/chat?bot=${a.id}` as never)} accessibilityRole="link" accessibilityLabel={`Ouvrir le chat ${a.label.toLowerCase()}`} style={({ hovered, focused }: { hovered?: boolean; focused?: boolean }) => [styles.audience, { backgroundColor: color.soft }, wide && styles.audienceWide, hovered && { borderColor: color.accent }, focused && tokens.focus.ring]}>
                  <View style={styles.rowTop}>
                    <View style={styles.audienceHeading}><Icon name={a.icon} size={tokens.size.iconMd} color={color.accent} /><Text style={[styles.audienceLabel, { color: color.accent }]}>{a.label}</Text></View>
                    <Icon name="arrowRight" size={tokens.size.iconMd} color={color.accent} />
                  </View>
                  <Text accessibilityRole="header" aria-level={3} style={styles.audienceTitle}>{a.title}</Text>
                  <Text style={styles.body}>{a.description}</Text>
                </Pressable>;
              })}
            </View>
          </View>
        </View>
        <View style={styles.toolsBand}>
          <View {...mi('landing-container')} style={[styles.page, compact && styles.pageCompact]}>
            <View style={styles.section}>
              <View {...mi('landing-tools-intro')} style={[styles.toolsIntro, wide && styles.toolsIntroWide]}>
                <View style={styles.sectionHead}>
                  <Text style={styles.label}>Votre espace de travail</Text>
                  <Text accessibilityRole="header" aria-level={2} style={styles.sectionTitle}>{user ? 'Vos outils de travail' : 'Les outils de MedInfo AI'}</Text>
                  <Text style={styles.toolsDescription}>Simulez un ECOS, construisez votre planning de révisions, préparez une présentation ou mettez en page votre CV.</Text>
                  <Text style={styles.body}>{user ? 'Retrouvez les outils accessibles avec votre rôle.' : 'L’accès aux outils dépend de votre rôle vérifié.'}</Text>
                </View>
                <View {...mi('landing-tools-photo')} style={[styles.toolsVisual, wide && styles.toolsVisualWide]}>
                  <LandingPhoto photo="work" sizes="(min-width: 1024px) 360px, (min-width: 640px) calc(100vw - 72px), calc(100vw - 56px)" />
                </View>
              </View>
              <View {...mi('landing-tools')} style={[styles.toolList, wide && styles.toolColumns]}>{features.map((f) => {
                const tint = featureTint(f.id);
                return <Pressable {...mi('landing-tool')} key={f.id} accessibilityRole="link" accessibilityLabel={f.label} onPress={() => router.push(f.route as never)} style={({ hovered, focused }: { hovered?: boolean; focused?: boolean }) => [styles.tool, wide && styles.toolWide, hovered && styles.rowHover, focused && tokens.focus.ring]}>
                  <View style={[styles.toolIcon, { backgroundColor: tint.bg }]}><Icon name={f.icon} size={tokens.size.iconMd} color={tint.fg} /></View>
                  <View style={styles.toolContent}><Text style={styles.toolTitle}>{f.label}</Text><Text style={styles.body}>{f.description}</Text></View>
                  <Icon name="arrowRight" size={tokens.size.iconSm} color={tokens.colors.accent} />
                </Pressable>;
              })}</View>
            </View>
          </View>
        </View>
        <View style={styles.trustBand}>
          <View {...mi('landing-container')} style={[styles.page, compact && styles.pageCompact]}>
            <View {...mi('landing-trust')} style={[styles.section, styles.trust, wide && styles.trustWide]}>
              <View style={styles.trustIntro}>
                <Text style={[styles.label, styles.trustAccent]}>Comment fonctionne MedInfo AI</Text>
                <Text accessibilityRole="header" aria-level={2} style={[styles.sectionTitle, styles.trustTitle]}>Pensé pour les études{'\n'}<Text style={styles.trustAccent}>et le travail médical.</Text></Text>
                <Text style={[styles.body, styles.trustBody]}>MedInfo AI associe des assistants conversationnels, des outils de création et un accès direct aux documents cités.</Text>
                <LandingPhoto photo="sources" />
              </View>
              <View style={styles.trustList}>
                {TRUST_ITEMS.map(([title, text]) => <View key={title} style={styles.trustRow}>
                  <Text accessibilityRole="header" aria-level={3} style={[styles.toolTitle, styles.trustTitle]}>{title}</Text>
                  <Text style={[styles.body, styles.trustBody]}>{text}</Text>
                </View>)}
              </View>
            </View>
          </View>
        </View>
        <View {...mi('landing-container')} style={[styles.page, compact && styles.pageCompact]}>
          <View style={styles.section}>
            <Text style={styles.label}>Avant de commencer</Text>
            <Text accessibilityRole="header" aria-level={2} style={styles.sectionTitle}>Questions fréquentes</Text>
            <View style={styles.faqList}>{FAQ_ITEMS.map((item, i) => <View {...mi('landing-faq')} key={item.question} style={[styles.faq, wide && styles.faqWide]}>
              <View {...mi('landing-faq-question')} style={[styles.faqQuestion, wide && styles.faqQuestionWide]}>
                <Text style={styles.faqNumber} aria-hidden>{String(i + 1).padStart(2, '0')}</Text>
                <Text accessibilityRole="header" aria-level={3} style={[styles.toolTitle, styles.faqQuestionText]}>{item.question}</Text>
              </View>
              <Text {...mi('landing-faq-answer')} style={[styles.body, wide && styles.faqAnswerWide]}>{item.answer}</Text>
            </View>)}</View>
          </View>
        </View>
      </MainContent>
      <SiteFooter />
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.colors.background },
  content: { flexGrow: 1 },
  page: { width: '100%', maxWidth: tokens.layout.page, alignSelf: 'center', paddingHorizontal: tokens.space.xl },
  pageCompact: { paddingHorizontal: tokens.space.lg },
  heroBand: { backgroundColor: tokens.colors.editorial.hero },
  toolsBand: { backgroundColor: tokens.colors.surface },
  trustBand: { backgroundColor: tokens.colors.editorial.ink },
  hero: { paddingVertical: tokens.space['3xl'], gap: tokens.space['2xl'] },
  heroWide: { flexDirection: 'row', paddingVertical: tokens.space['4xl'], gap: tokens.space['4xl'] },
  intro: { flex: 1, gap: tokens.space.xl, justifyContent: 'center' },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.md },
  eyebrowRule: { width: tokens.space.xl, height: tokens.border.accent, backgroundColor: tokens.colors.accent, flexShrink: 0 },
  kicker: { flex: 1, fontFamily: tokens.font.display, color: tokens.colors.textSubtle, ...tokens.type.label },
  headline: { fontFamily: tokens.font.serif, color: tokens.colors.text, ...tokens.type.landing, fontWeight: tokens.weight.regular },
  headlineCompact: { ...tokens.type.display },
  headlineAccent: { color: tokens.colors.accent, fontStyle: 'italic' },
  subhead: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, ...tokens.type.bodyLg, maxWidth: tokens.layout.form },
  highlights: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm },
  // Repères non interactifs : texte encre sur filet neutre (en bleu sur fond blanc, ils se lisaient comme des liens).
  highlight: { fontFamily: tokens.font.display, color: tokens.colors.textSubtle, ...tokens.type.caption, borderWidth: tokens.border.thin, borderColor: tokens.colors.borderControl, paddingHorizontal: tokens.space.md, paddingVertical: tokens.space.xs, borderRadius: tokens.radius.md },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.md },
  actionsCompact: { flexDirection: 'column', alignItems: 'stretch' },
  meta: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, ...tokens.type.caption },
  disclosure: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, ...tokens.type.caption, borderLeftWidth: tokens.border.accent, borderLeftColor: tokens.colors.accent, paddingLeft: tokens.space.md },
  heroVisual: { gap: tokens.space.md, width: '100%' },
  heroVisualWide: { flex: 1, maxWidth: tokens.layout.form, alignSelf: 'center' },
  photoMount: { padding: tokens.space.lg, backgroundColor: tokens.colors.editorial.photoMount, borderRadius: tokens.radius.xl, gap: tokens.space.lg },
  photoTopline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: tokens.space.md },
  photoLabel: { flex: 1, fontFamily: tokens.font.display, color: tokens.colors.personas.student.accent, ...tokens.type.label, fontWeight: tokens.weight.medium },
  audiencesSection: { paddingVertical: tokens.space['3xl'], gap: tokens.space.lg },
  audiences: { gap: tokens.space.lg },
  audiencesWide: { flexDirection: 'row', gap: tokens.space.lg },
  label: { fontFamily: tokens.font.display, color: tokens.colors.textMuted, ...tokens.type.label, marginBottom: tokens.space.sm },
  audience: { borderWidth: tokens.border.thin, borderColor: tokens.colors.transparent, borderRadius: tokens.radius.xl, padding: tokens.space.xl, gap: tokens.space.md, minHeight: tokens.size.controlMd, ...tokens.motion.transitionWeb },
  audienceWide: { flex: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: tokens.space.md },
  audienceHeading: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  audienceLabel: { flex: 1, fontFamily: tokens.font.display, ...tokens.type.label, fontWeight: tokens.weight.medium },
  audienceTitle: { fontFamily: tokens.font.display, color: tokens.colors.text, ...tokens.type.h3, fontWeight: tokens.weight.medium },
  body: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, ...tokens.type.body },
  section: { paddingVertical: tokens.space['4xl'], gap: tokens.space.xl },
  sectionHead: { flex: 1, gap: tokens.space.md },
  toolsIntro: { gap: tokens.space.xl, marginBottom: tokens.space.lg },
  toolsIntroWide: { flexDirection: 'row', alignItems: 'center', gap: tokens.space['4xl'] },
  toolsDescription: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, ...tokens.type.bodyLg, maxWidth: tokens.layout.form },
  toolsVisual: { width: '100%', padding: tokens.space.md, backgroundColor: tokens.colors.editorial.warmMount, borderRadius: tokens.radius.xl },
  toolsVisualWide: { flex: 1, maxWidth: tokens.layout.audience },
  sectionTitle: { fontFamily: tokens.font.serif, color: tokens.colors.text, ...tokens.type.h1, fontWeight: tokens.weight.regular },
  toolList: { gap: tokens.space.xs },
  toolColumns: { flexDirection: 'row', flexWrap: 'wrap', columnGap: tokens.space['2xl'] },
  tool: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.md, paddingVertical: tokens.space.xl, paddingHorizontal: tokens.space.xs, borderTopWidth: tokens.border.thin, borderTopColor: tokens.colors.border, minHeight: tokens.size.controlMd, ...tokens.motion.transitionWeb },
  toolWide: { width: '48%' },
  toolIcon: { width: tokens.size.iconButton, height: tokens.size.iconButton, alignItems: 'center', justifyContent: 'center', borderRadius: tokens.radius.md, flexShrink: 0 },
  toolContent: { flex: 1, gap: tokens.space.xs },
  toolTitle: { fontFamily: tokens.font.display, color: tokens.colors.text, ...tokens.type.h3, fontWeight: tokens.weight.medium },
  rowHover: { backgroundColor: tokens.colors.surfaceAlt },
  trust: { gap: tokens.space['2xl'] },
  trustWide: { flexDirection: 'row', gap: tokens.space['4xl'] },
  trustIntro: { flex: 1, gap: tokens.space.lg },
  trustList: { flex: 1, gap: tokens.space.xl },
  trustRow: { gap: tokens.space.sm, paddingTop: tokens.space.lg, borderTopWidth: tokens.border.thin, borderTopColor: tokens.colors.editorial.inkRule },
  trustTitle: { color: tokens.colors.editorial.onInk },
  trustBody: { color: tokens.colors.editorial.onInkMuted },
  trustAccent: { color: tokens.colors.editorial.highlight },
  faqList: { width: '100%' },
  faq: { paddingVertical: tokens.space.xl, gap: tokens.space.lg, borderTopWidth: tokens.border.thin, borderTopColor: tokens.colors.border },
  faqWide: { flexDirection: 'row', gap: tokens.space['3xl'] },
  faqQuestion: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.space.md },
  faqQuestionWide: { flex: 1 },
  faqQuestionText: { flex: 1 },
  // Numéro de question (ADR-0040) en chiffres tabulaires du corps : la police à chasse fixe reste réservée aux valeurs techniques.
  faqNumber: { fontFamily: tokens.font.sans, fontVariant: ['tabular-nums'], fontWeight: tokens.weight.semibold, color: tokens.colors.accent, ...tokens.type.caption, paddingTop: tokens.space.xs },
  faqAnswerWide: { flex: 2, maxWidth: tokens.layout.measure },
});
