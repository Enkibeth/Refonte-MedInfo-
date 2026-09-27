import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSession } from '@/auth/AuthProvider';
import { isAdminUserId } from '@/admin/index';
import type { Persona } from '@/ai/prompts/_schema';
import { APP_FEATURES, visibleFeatures } from '@/ai/routing/featureVisibility';
import { INTENDED_PURPOSE, getAiDisclosure } from '@/compliance/disclosures';
import { PAGE_SEO, faqPageJsonLd, organizationJsonLd, webSiteJsonLd, type FaqItem } from '@/seo/meta';
import { Button } from '@/ui/Button';
import { Icon, type IconName } from '@/ui/icons';
import { LandingHeader } from '@/ui/LandingHeader';
import { SeoHead } from '@/ui/SeoHead';
import { SiteFooter } from '@/ui/SiteFooter';
import { tokens } from '@/ui/tokens';

const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'MedInfo AI est-il gratuit ?',
    answer:
      'Oui pour commencer : le premier message est gratuit, sans inscription, sur les trois chatbots. ' +
      'Un compte gratuit permet de continuer ; les abonnements lèvent seulement les limites de volume ' +
      'et débloquent des fonctions avancées. Les sources officielles (HAS, ANSM…) restent gratuites pour tous.',
  },
  {
    question: 'MedInfo AI remplace-t-il un médecin ou un pharmacien ?',
    answer:
      "Non. MedInfo AI fournit de l'information médicale générale, jamais un diagnostic ni un avis " +
      "individuel. En cas de symptôme inquiétant, consultez un professionnel de santé ; en cas d'urgence, " +
      'composez le 15 (SAMU) ou le 112.',
  },
  {
    question: "D'où viennent les réponses ?",
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
      'Analyse de document médical avec citations ancrées (grand public), simulation ECOS, planning de ' +
      'révisions et analyse des partiels (étudiants), compte rendu de consultation dicté (professionnels), ' +
      'générateur de présentations et créateur de CV médical (étudiants et professionnels).',
  },
  {
    question: 'Mes conversations sont-elles privées ?',
    answer:
      'Oui : votre historique de conversations n’est visible que par vous (isolation stricte par compte) ' +
      'et vous pouvez l’exporter en PDF ou le supprimer. Les documents analysés ne sont jamais stockés.',
  },
];

const AUDIENCES: { id: Persona; label: string; title: string; description: string; icon: IconName }[] = [
  { id: 'public', label: 'Grand public', title: 'Comprendre une information de santé', description: 'Des explications accessibles, sans avis individuel.', icon: 'users' },
  { id: 'student', label: 'Étudiants en santé', title: 'Approfondir. Réviser. Comprendre.', description: 'Des notions aux référentiels, pour structurer vos révisions.', icon: 'bookOpen' },
  { id: 'professional', label: 'Professionnels de santé', title: 'Consulter les recommandations', description: 'Une synthèse à confronter aux sources et à leur contexte.', icon: 'stethoscope' },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user, persona } = useSession();
  const { width } = useWindowDimensions();
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
      <View style={[styles.page, compact && styles.pageCompact]}>
        <View style={[styles.hero, wide && styles.heroWide]}>
          <View style={styles.intro}>
            <Text style={styles.kicker}>MedInfo AI · Information médicale générale</Text>
            <Text accessibilityRole="header" aria-level={1} style={[styles.headline, !wide && styles.headlineCompact]}>Une question médicale.{'\n'}<Text style={styles.headlineAccent}>Revenir aux sources.</Text></Text>
            <Text style={styles.subhead}>Comprendre, apprendre, approfondir. Un espace de travail pour explorer l’information médicale et consulter les références citées.</Text>
            <View style={[styles.heroActions, compact && styles.actionsCompact]}>
              <Button label={user ? 'Ouvrir le chat' : 'Essayer sans inscription'} onPress={() => router.push('/(chat)/chat')} fullWidth={compact} />
              <Button label={user ? 'Mon espace' : 'Se connecter'} variant="ghost" onPress={() => router.push(user ? '/(chat)/dashboard' : '/(auth)/sign-in')} fullWidth={compact} />
            </View>
            {!user ? <Text style={styles.meta}>Un premier message gratuit, sans créer de compte.</Text> : null}
            <Text style={styles.disclosure}>{getAiDisclosure()}</Text>
          </View>
          <View style={[styles.audiences, wide && styles.audiencesWide]}>
            <Text style={styles.label}>Trois espaces de conversation</Text>
            {audiences.map((a) => <Pressable key={a.id} onPress={() => router.push(`/(chat)/chat?bot=${a.id}` as never)} accessibilityRole="link" accessibilityLabel={`Ouvrir le chat ${a.label.toLowerCase()}`} style={({ hovered, focused }: { hovered?: boolean; focused?: boolean }) => [styles.audience, hovered && styles.rowHover, focused && tokens.focus.ring]}>
              <View style={styles.rowTop}><Text style={styles.audienceLabel}>{a.label}</Text><Icon name="arrowRight" size={tokens.size.iconMd} color={tokens.colors.accent} /></View>
              <Text style={styles.audienceTitle}>{a.title}</Text>
              <Text style={styles.body}>{a.description}</Text>
            </Pressable>)}
          </View>
        </View>
        <View style={styles.section}>
          <View style={styles.sectionHead}><Text accessibilityRole="header" aria-level={2} style={styles.sectionTitle}>{user ? 'Vos outils de travail' : 'Un outil pour chaque travail'}</Text><Text style={styles.body}>{user ? 'Retrouvez les outils accessibles avec votre rôle.' : 'L’accès aux outils dépend de votre rôle vérifié.'}</Text></View>
          <View style={[styles.toolList, wide && styles.toolColumns]}>{features.map((f, i) => <Pressable key={f.id} accessibilityRole="link" accessibilityLabel={f.label} onPress={() => router.push(f.route as never)} style={({ hovered, focused }: { hovered?: boolean; focused?: boolean }) => [styles.tool, wide && styles.toolWide, hovered && styles.rowHover, focused && tokens.focus.ring]}>
            <Text style={styles.index}>{String(i + 1).padStart(2, '0')}</Text><Icon name={f.icon} size={tokens.size.iconMd} color={tokens.colors.textMuted} /><View style={styles.toolContent}><Text style={styles.toolTitle}>{f.label}</Text><Text style={styles.body}>{f.description}</Text></View><Icon name="arrowRight" size={tokens.size.iconSm} color={tokens.colors.accent} />
          </Pressable>)}</View>
        </View>
        <View style={[styles.section, styles.trust, wide && styles.trustWide]}>
          <View style={styles.trustIntro}><Text accessibilityRole="header" aria-level={2} style={styles.sectionTitle}>Une réponse se lit.{'\n'}Une source se consulte.</Text><Text style={styles.body}>Gardez un regard critique sur les informations produites par un système d’intelligence artificielle.</Text></View>
          <View style={styles.trustList}>
            {[['Retrouver les références', 'Les citations permettent de revenir aux documents d’origine. Consultez leur date et leur contexte.'], ['Des sources accessibles', 'L’abonnement ne bloque jamais l’accès aux sources citées.'], ['Un cadre explicite', INTENDED_PURPOSE]].map(([title, text]) => <View key={title} style={styles.trustRow}><Text style={styles.toolTitle}>{title}</Text><Text style={styles.body}>{text}</Text></View>)}
          </View>
        </View>
        <View style={styles.section}><Text accessibilityRole="header" aria-level={2} style={styles.sectionTitle}>Questions fréquentes</Text><View style={styles.faqList}>{FAQ_ITEMS.map(item => <View key={item.question} style={styles.faq}><Text accessibilityRole="header" aria-level={3} style={styles.toolTitle}>{item.question}</Text><Text style={styles.body}>{item.answer}</Text></View>)}</View></View>
      </View>
      <SiteFooter />
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.colors.background },
  content: { flexGrow: 1 },
  page: { width: '100%', maxWidth: tokens.layout.page, alignSelf: 'center', paddingHorizontal: tokens.space.xl },
  pageCompact: { paddingHorizontal: tokens.space.lg },
  hero: { paddingVertical: tokens.space['3xl'], gap: tokens.space['3xl'], borderBottomWidth: tokens.border.thin, borderBottomColor: tokens.colors.border },
  heroWide: { flexDirection: 'row', paddingVertical: tokens.space['4xl'], gap: tokens.space['4xl'] },
  intro: { flex: 1, gap: tokens.space.xl },
  kicker: { fontFamily: tokens.font.display, color: tokens.colors.textMuted, ...tokens.type.label },
  headline: { fontFamily: tokens.font.serif, color: tokens.colors.text, ...tokens.type.landing, fontWeight: tokens.weight.regular },
  headlineCompact: { ...tokens.type.display },
  headlineAccent: { color: tokens.colors.accent, fontStyle: 'italic' },
  subhead: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, ...tokens.type.bodyLg, maxWidth: tokens.layout.form },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.md },
  actionsCompact: { flexDirection: 'column', alignItems: 'stretch' },
  meta: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, ...tokens.type.caption },
  disclosure: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, ...tokens.type.caption, borderLeftWidth: tokens.border.accent, borderLeftColor: tokens.colors.borderStrong, paddingLeft: tokens.space.md },
  audiences: { gap: tokens.space.sm },
  audiencesWide: { flex: 1, maxWidth: tokens.layout.audience },
  label: { fontFamily: tokens.font.display, color: tokens.colors.textMuted, ...tokens.type.label, marginBottom: tokens.space.sm },
  audience: { borderTopWidth: tokens.border.thin, borderTopColor: tokens.colors.border, paddingVertical: tokens.space.xl, gap: tokens.space.sm, minHeight: tokens.size.controlMd },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: tokens.space.md },
  audienceLabel: { fontFamily: tokens.font.display, color: tokens.colors.accent, ...tokens.type.label, fontWeight: tokens.weight.medium },
  audienceTitle: { fontFamily: tokens.font.display, color: tokens.colors.text, ...tokens.type.h3, fontWeight: tokens.weight.medium },
  body: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, ...tokens.type.body },
  section: { paddingVertical: tokens.space['3xl'], gap: tokens.space.xl, borderBottomWidth: tokens.border.thin, borderBottomColor: tokens.colors.border },
  sectionHead: { gap: tokens.space.sm },
  sectionTitle: { fontFamily: tokens.font.serif, color: tokens.colors.text, ...tokens.type.h1, fontWeight: tokens.weight.regular },
  toolList: { gap: tokens.space.xs },
  toolColumns: { flexDirection: 'row', flexWrap: 'wrap', columnGap: tokens.space['2xl'] },
  tool: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.md, paddingVertical: tokens.space.lg, borderTopWidth: tokens.border.thin, borderTopColor: tokens.colors.border, minHeight: tokens.size.controlMd },
  toolWide: { width: '48%' },
  toolContent: { flex: 1, gap: tokens.space.xs },
  toolTitle: { fontFamily: tokens.font.display, color: tokens.colors.text, ...tokens.type.h3, fontWeight: tokens.weight.medium },
  index: { fontFamily: tokens.font.mono, color: tokens.colors.textMuted, ...tokens.type.caption },
  rowHover: { backgroundColor: tokens.colors.surfaceAlt },
  trust: { gap: tokens.space['2xl'] },
  trustWide: { flexDirection: 'row', gap: tokens.space['4xl'] },
  trustIntro: { flex: 1, gap: tokens.space.lg },
  trustList: { flex: 1, gap: tokens.space.xl },
  trustRow: { gap: tokens.space.sm },
  faqList: { maxWidth: tokens.layout.reading },
  faq: { paddingVertical: tokens.space.xl, gap: tokens.space.sm, borderTopWidth: tokens.border.thin, borderTopColor: tokens.colors.border },
});
