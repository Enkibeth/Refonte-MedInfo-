/**
 * Page 404 du site (remplace l'écran « Unmatched Route » de développement d'Expo, qui
 * s'affichait en production sans titre, sans en-tête ni lien utile).
 *
 * Servie avec le statut HTTP 404 (server/lib/html.mjs → route `+not-found` du manifeste) et
 * exclue des moteurs (`noindex`).
 */
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/ui/Button';
import { LandingHeader } from '@/ui/LandingHeader';
import { MainContent } from '@/ui/landmarks';
import { PageTitle } from '@/ui/PageTitle';
import { SeoHead } from '@/ui/SeoHead';
import { SiteFooter } from '@/ui/SiteFooter';
import { tokens } from '@/ui/tokens';

const SHORTCUTS: { label: string; href: string }[] = [
  { label: 'Poser une question au chat', href: '/chat' },
  { label: 'Lire le blog santé', href: '/blog' },
  { label: 'Voir les tarifs', href: '/pricing' },
  { label: 'Nous contacter', href: '/contact' },
];

export default function NotFoundScreen() {
  const router = useRouter();
  return (
    <View style={styles.screen}>
      <SeoHead
        title="Page introuvable"
        description="Cette adresse ne correspond à aucune page de MedInfo AI."
        path="/404"
        noindex
      />
      <LandingHeader />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <MainContent style={styles.inner}>
          <Text style={styles.eyebrow}>Erreur 404</Text>
          <PageTitle style={styles.title}>Page introuvable.</PageTitle>
          <Text style={styles.lead}>
            Cette adresse ne mène à aucune page : le lien est peut-être incomplet, ou la page a été
            déplacée.
          </Text>
          <View style={styles.actions}>
            <Button label="Retour à l’accueil" onPress={() => router.replace('/')} fullWidth={false} />
            <Button
              label="Essayer le chat"
              variant="ghost"
              onPress={() => router.push('/(chat)/chat')}
              fullWidth={false}
            />
          </View>
          <View style={styles.shortcuts}>
            <Text accessibilityRole="header" aria-level={2} style={styles.shortcutsTitle}>
              Raccourcis
            </Text>
            {SHORTCUTS.map((item) => (
              <Text
                key={item.href}
                {...({ href: item.href } as object)}
                role="link"
                onPress={(event) => {
                  event.preventDefault();
                  router.push(item.href as never);
                }}
                style={styles.shortcut}
              >
                {item.label}
              </Text>
            ))}
          </View>
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
  inner: {
    width: '100%',
    maxWidth: 720,
    paddingHorizontal: tokens.space.xl,
    paddingTop: tokens.space['2xl'],
    gap: tokens.space.lg,
  },
  eyebrow: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  title: {
    fontSize: tokens.type.display.fontSize,
    lineHeight: tokens.type.display.lineHeight,
    letterSpacing: tokens.type.display.letterSpacing,
  },
  lead: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.bodyLg.fontSize,
    lineHeight: tokens.type.bodyLg.lineHeight,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.md },
  shortcuts: {
    marginTop: tokens.space.lg,
    gap: tokens.space.sm,
    borderTopWidth: tokens.border.thin,
    borderTopColor: tokens.colors.border,
    paddingTop: tokens.space.lg,
  },
  shortcutsTitle: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    fontWeight: tokens.weight.bold,
  },
  shortcut: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    fontWeight: tokens.weight.semibold,
    textDecorationLine: 'underline',
    alignSelf: 'flex-start',
    minHeight: tokens.size.controlMd,
    paddingVertical: tokens.space.sm,
  },
  footerSpacer: { height: tokens.space['3xl'] },
});
