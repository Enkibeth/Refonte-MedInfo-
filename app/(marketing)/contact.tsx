/**
 * Page Contact (audit landing 2026-06) — contenu statique public.
 * Pas de formulaire serveur pour l'instant : contact par e-mail (mailto) +
 * renvois vers les pages légales et le chat.
 */
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

import { PAGE_SEO, breadcrumbJsonLd, organizationJsonLd } from '@/seo/meta';
import { LandingHeader } from '@/ui/LandingHeader';
import { Icon, type IconName } from '@/ui/icons';
import { Reveal } from '@/ui/Reveal';
import { SeoHead } from '@/ui/SeoHead';
import { SiteFooter } from '@/ui/SiteFooter';
import { tokens } from '@/ui/tokens';

const CONTACT_EMAIL = 'medaifr1@gmail.com';

export default function ContactScreen() {
  const router = useRouter();

  const cards: {
    icon: IconName;
    title: string;
    text: string;
    cta: string;
    onPress: () => void;
  }[] = [
    {
      icon: 'messageCircle',
      title: 'Une question santé ?',
      text: "Le chat MedInfo AI répond à vos questions d'information générale, avec sources. Le premier message ne demande pas d'inscription.",
      cta: 'Ouvrir le chat',
      onPress: () => router.push('/(chat)/chat'),
    },
    {
      icon: 'fileText',
      title: 'Support & partenariats',
      text: "Un problème avec votre compte, une suggestion, une demande presse ou partenariat : écrivez-nous, nous répondons sous 48 h ouvrées.",
      cta: CONTACT_EMAIL,
      onPress: () => void Linking.openURL(`mailto:${CONTACT_EMAIL}`),
    },
    {
      icon: 'shield',
      title: 'Données personnelles',
      text: 'Pour exercer vos droits RGPD (accès, rectification, suppression), consultez notre politique de confidentialité ou contactez-nous par e-mail.',
      cta: 'Politique de confidentialité',
      onPress: () => router.push('/(legal)/confidentialite' as never),
    },
  ];

  return (
    <View style={styles.screen}>
      <SeoHead
        title={PAGE_SEO.contact.title}
        description={PAGE_SEO.contact.description}
        path={PAGE_SEO.contact.path}
        jsonLd={[
          organizationJsonLd(),
          breadcrumbJsonLd([
            { name: 'Accueil', path: '/' },
            { name: 'Contact', path: PAGE_SEO.contact.path },
          ]),
        ]}
      />
      <LandingHeader />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.inner}>
          <Reveal>
            <Text style={styles.eyebrow}>Contact</Text>
            <Text style={styles.title}>Parlons-en.</Text>
            <Text style={styles.lead}>
              Une question, une suggestion, un problème ? Choisissez le bon canal ci-dessous.
              En cas d'urgence médicale, composez le 15 (SAMU) ou le 112 : MedInfo AI n'est
              pas une plateforme d'urgence.
            </Text>
          </Reveal>

          {cards.map((c, i) => (
            <Reveal key={c.title} delay={tokens.motion.revealStagger * (i + 1)}>
              <View style={styles.card}>
                <View style={styles.cardIcon}>
                  <Icon name={c.icon} size={20} color={tokens.colors.accent} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{c.title}</Text>
                  <Text style={styles.cardText}>{c.text}</Text>
                  <TouchableOpacity
                    onPress={c.onPress}
                    accessibilityRole="button"
                    accessibilityLabel={c.cta}
                    style={styles.cardCta}
                  >
                    <Text style={styles.cardCtaText}>{c.cta}</Text>
                    <Icon name="arrowRight" size={14} color={tokens.colors.accentVivid} />
                  </TouchableOpacity>
                </View>
              </View>
            </Reveal>
          ))}
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
    paddingTop: tokens.space['2xl'],
    gap: tokens.space.lg,
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
  },
  card: {
    flexDirection: 'row',
    gap: tokens.space.lg,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: tokens.space.xl,
    ...tokens.elevation.sm,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: tokens.space.xs },
  cardTitle: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    letterSpacing: tokens.type.h3.letterSpacing,
    fontWeight: tokens.weight.bold,
  },
  cardText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.label.fontSize,
    lineHeight: tokens.type.label.lineHeight,
  },
  cardCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    marginTop: tokens.space.sm,
    alignSelf: 'flex-start',
  },
  cardCtaText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentVivid,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
});
