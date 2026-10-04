import { PageTitle } from '@/ui/PageTitle';
/**
 * Page « Qui sommes-nous » (audit landing 2026-06) — contenu statique public.
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { PAGE_SEO, breadcrumbJsonLd, organizationJsonLd } from '@/seo/meta';
import { Button } from '@/ui/Button';
import { LandingHeader } from '@/ui/LandingHeader';
import { MainContent } from '@/ui/landmarks';
import { Icon, type IconName } from '@/ui/icons';
import { Reveal } from '@/ui/Reveal';
import { SeoHead } from '@/ui/SeoHead';
import { SiteFooter } from '@/ui/SiteFooter';
import { tokens } from '@/ui/tokens';

const VALUES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'bookOpen',
    title: 'Accessibilité',
    text: "Une information médicale claire, en français, compréhensible sans bagage scientifique, et des sources toujours consultables gratuitement.",
  },
  {
    icon: 'sparkles',
    title: 'Innovation',
    text: 'Des modèles d’IA récents au service de l’information en santé : réponses sourcées, outils pour étudiants et professionnels.',
  },
  {
    icon: 'shield',
    title: 'Références',
    text: 'Des références citées pour approfondir vos lectures et revenir aux recommandations ou publications d’origine.',
  },
  {
    icon: 'refresh',
    title: 'Amélioration continue',
    text: 'Le projet évolue avec l’usage : outils, modèles et ergonomie sont revus au fil des versions.',
  },
];

export default function AboutScreen() {
  const router = useRouter();
  return (
    <View style={styles.screen}>
      <SeoHead
        title={PAGE_SEO.about.title}
        description={PAGE_SEO.about.description}
        path={PAGE_SEO.about.path}
        jsonLd={[
          organizationJsonLd(),
          breadcrumbJsonLd([
            { name: 'Accueil', path: '/' },
            { name: 'À propos', path: PAGE_SEO.about.path },
          ]),
        ]}
      />
      <LandingHeader />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <MainContent style={styles.inner}>
          <Reveal>
            <Text style={styles.eyebrow}>Qui sommes-nous</Text>
            <PageTitle style={styles.title}>Un projet né pendant les études de médecine</PageTitle>
          </Reveal>
          <Reveal delay={tokens.motion.revealStagger}>
            <Text style={styles.lead}>
              Créé par Hugo Bettembourg, étudiant en médecine, MedInfo AI part des besoins
              concrets de la formation médicale : comprendre, réviser, retrouver les références
              et produire des travaux structurés.
            </Text>
            <Text style={styles.paragraph}>
              Le projet associe des modèles d’IA OpenAI et Anthropic à des outils dédiés :
              simulation ECOS, planning de révisions, présentations, CV et rédaction d’articles.
              Le chat fonctionne aujourd’hui avec GPT-6 Luna.
            </Text>
            <Text style={styles.paragraph}>
              Trois assistants s’adressent chacun à un public : le grand public
              (explications sans jargon, analyse de document médical), les étudiants en santé
              (référentiels des Collèges EDN/R2C, simulation ECOS, planning de révisions,
              présentations, CV) et les professionnels (synthèses fondées sur les preuves,
              compte rendu de consultation dicté).
            </Text>
            <Text style={styles.paragraph}>
              Les assistants peuvent rechercher des références médicales selon le mode choisi.
              Les documents cités restent accessibles pour poursuivre la lecture : recommandations,
              référentiels et publications scientifiques.
            </Text>
            <Text style={styles.paragraph}>
              MedInfo AI fournit de l’information médicale générale, jamais un avis médical
              individuel. En cas d’urgence, composez le 15 ou le 112.
            </Text>
          </Reveal>

          <Reveal delay={tokens.motion.revealStagger * 2} style={styles.valuesPanel}>
            <Text style={styles.valuesTitle}>Nos engagements</Text>
            {VALUES.map((v, i) => (
              <View key={v.title} style={[styles.valueRow, i > 0 && styles.valueRowDivided]}>
                <View style={styles.valueIcon}>
                  <Icon name={v.icon} size={20} color={tokens.colors.accent} />
                </View>
                <View style={styles.valueTextBlock}>
                  <Text style={styles.valueTitle}>{v.title}</Text>
                  <Text style={styles.valueText}>{v.text}</Text>
                </View>
              </View>
            ))}
          </Reveal>

          <Reveal delay={tokens.motion.revealStagger * 3} style={styles.ctaRow}>
            <Button
              label="Essayer le chat"
              fullWidth={false}
              onPress={() => router.push('/(chat)/chat')}
            />
            <Button
              label="Nous contacter"
              variant="secondary"
              fullWidth={false}
              onPress={() => router.push('/(marketing)/contact' as never)}
            />
          </Reveal>
        </MainContent>
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
    paddingTop: tokens.space['2xl'],
    gap: tokens.space.lg,
  },
  eyebrow: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep, // texte : accentVivid n’atteint pas 4,5:1 sur le fond ivoire
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
    textTransform: 'none',
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
    color: tokens.colors.text,
    fontSize: tokens.type.bodyLg.fontSize,
    lineHeight: tokens.type.bodyLg.lineHeight,
  },
  paragraph: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    marginTop: tokens.space.md,
  },
  valuesPanel: {
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: tokens.space.xl,
    marginTop: tokens.space.md,
    ...tokens.elevation.sm,
  },
  valuesTitle: {
    fontFamily: tokens.font.serif,
    color: tokens.colors.text,
    fontSize: tokens.type.h2.fontSize,
    lineHeight: tokens.type.h2.lineHeight,
    letterSpacing: tokens.type.h2.letterSpacing,
    fontWeight: tokens.weight.semibold,
    marginBottom: tokens.space.sm,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.space.lg,
    paddingVertical: tokens.space.lg,
  },
  valueRowDivided: { borderTopWidth: 1, borderTopColor: tokens.colors.border },
  valueIcon: {
    width: 36,
    height: 36,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueTextBlock: { flex: 1, gap: 2 },
  valueTitle: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    letterSpacing: tokens.type.h3.letterSpacing,
    fontWeight: tokens.weight.bold,
  },
  valueText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.label.fontSize,
    lineHeight: tokens.type.label.lineHeight,
  },
  ctaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.md, marginTop: tokens.space.sm },
});
