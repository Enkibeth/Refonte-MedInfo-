/**
 * Présentation publique d'un outil, montrée aux visiteurs non connectés (SEO 2026-10).
 *
 * Remplace la carte « réservé aux comptes » de RoleGate : en-tête et pied du site, titre,
 * ce que fait l'outil, pour qui, comment y accéder et liens vers les autres outils. Rendue
 * dès le pré-rendu (cf. RoleGate) : c'est le contenu que lisent les moteurs et les aperçus.
 * Contenu : src/seo/toolPages.ts (faits du produit, testés).
 *
 * Rendue À L'INTÉRIEUR du `<main>` de l'écran : l'en-tête et le pied n'y portent pas leurs
 * rôles de repère (banner/contentinfo), réservés au niveau du document.
 */
import { Link, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { APP_FEATURES } from '@/ai/routing/featureVisibility';
import { TOOL_PAGES, type ToolPageId } from '@/seo/toolPages';
import { featureTint } from './featureChips';
import { Icon } from './icons';
import { buttonLinkProps } from './interaction';
import { LandingHeader } from './LandingHeader';
import { navLinkProps } from './navLink';
import { SiteFooter } from './SiteFooter';
import { tokens } from './tokens';

export function ToolPreview({ feature }: { feature: ToolPageId }) {
  const router = useRouter();
  const page = TOOL_PAGES[feature];
  const meta = APP_FEATURES.find((f) => f.id === feature);
  const tint = featureTint(feature);
  const others = APP_FEATURES.filter((f) => f.id !== feature && f.id !== 'chat');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <LandingHeader landmark={false} />
      <View style={styles.page}>
        <View style={styles.hero}>
          <View style={styles.eyebrow}>
            {meta ? (
              <View style={[styles.icon, { backgroundColor: tint.bg }]}>
                <Icon name={meta.icon} size={tokens.size.iconMd} color={tint.fg} />
              </View>
            ) : null}
            <Text style={styles.kicker}>Outil MedInfo AI</Text>
          </View>
          <Text accessibilityRole="header" aria-level={1} style={styles.title}>
            {page.title}
          </Text>
          <Text style={styles.lead}>{page.lead}</Text>
        </View>

        <View style={styles.card}>
          <Text accessibilityRole="header" aria-level={2} style={styles.cardTitle}>
            Ce que permet l’outil
          </Text>
          <View role="list" style={styles.points}>
            {page.points.map((point) => (
              <View key={point} role="listitem" style={styles.point}>
                <Icon name="check" size={tokens.size.iconSm} color={tokens.colors.success} />
                <Text style={styles.pointText}>{point}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.audience}>
            <Text style={styles.audienceLabel}>Accès : </Text>
            {page.audience}
          </Text>
          {page.note ? <Text style={styles.note}>{page.note}</Text> : null}
        </View>

        <View style={styles.actions}>
          <Link href="/(auth)/sign-in?mode=signup" style={styles.primary} {...buttonLinkProps()}>
            Créer un compte gratuit
          </Link>
          <Link href="/(auth)/sign-in" style={styles.secondary} {...buttonLinkProps()}>
            Se connecter
          </Link>
        </View>
        <Link href="/(chat)/chat" style={styles.textLink}>
          Essayer le chat sans inscription
        </Link>

        <View style={styles.others}>
          <Text accessibilityRole="header" aria-level={2} style={styles.cardTitle}>
            Les autres outils
          </Text>
          <View role="list">
            {others.map((other) => {
              const otherTint = featureTint(other.id);
              const otherPage = TOOL_PAGES[other.id as ToolPageId];
              return (
                <View key={other.id} role="listitem">
                  <Pressable
                    {...navLinkProps(other.route, () => router.push(other.route as never))}
                    accessibilityRole="link"
                    style={({ hovered, focused }: { hovered?: boolean; focused?: boolean }) => [
                      styles.otherRow,
                      hovered && styles.otherRowHover,
                      focused && tokens.focus.ring,
                    ]}
                  >
                    <View style={[styles.icon, { backgroundColor: otherTint.bg }]}>
                      <Icon name={other.icon} size={tokens.size.iconMd} color={otherTint.fg} />
                    </View>
                    <View style={styles.otherText}>
                      <Text style={styles.otherTitle}>{otherPage?.title ?? other.label}</Text>
                      {otherPage ? <Text style={styles.otherLead}>{otherPage.audience}</Text> : null}
                    </View>
                    <Icon name="arrowRight" size={tokens.size.iconSm} color={tokens.colors.accent} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>
      </View>
      <SiteFooter landmark={false} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.colors.background },
  content: { flexGrow: 1 },
  page: {
    width: '100%',
    maxWidth: tokens.layout.reading,
    alignSelf: 'center',
    paddingHorizontal: tokens.space.lg,
    paddingTop: tokens.space['3xl'],
    paddingBottom: tokens.space['4xl'],
    gap: tokens.space.xl,
  },
  hero: { gap: tokens.space.md },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.md },
  icon: {
    width: tokens.size.iconButton,
    height: tokens.size.iconButton,
    borderRadius: tokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  kicker: { fontFamily: tokens.font.display, color: tokens.colors.textSubtle, ...tokens.type.label },
  title: { fontFamily: tokens.font.serif, fontWeight: tokens.weight.regular, color: tokens.colors.text, ...tokens.type.display },
  lead: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, ...tokens.type.bodyLg },
  card: {
    backgroundColor: tokens.colors.surface,
    borderWidth: tokens.border.thin,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.xl,
    padding: tokens.space.xl,
    gap: tokens.space.lg,
  },
  cardTitle: { fontFamily: tokens.font.display, color: tokens.colors.text, ...tokens.type.h3, fontWeight: tokens.weight.semibold },
  points: { gap: tokens.space.md },
  point: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.space.md },
  pointText: { flex: 1, fontFamily: tokens.font.sans, color: tokens.colors.text, ...tokens.type.body },
  audience: { fontFamily: tokens.font.sans, color: tokens.colors.textSubtle, ...tokens.type.body },
  audienceLabel: { fontWeight: tokens.weight.semibold, color: tokens.colors.text },
  note: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, ...tokens.type.caption },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.md },
  primary: {
    minHeight: tokens.size.buttonLg,
    paddingHorizontal: tokens.space.xl,
    paddingVertical: tokens.space.md + 2,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.accentVivid,
    color: tokens.colors.onAccent,
    fontFamily: tokens.font.display,
    fontWeight: tokens.weight.semibold,
    ...tokens.type.label,
    lineHeight: tokens.type.label.lineHeight,
    textAlign: 'center',
    overflow: 'hidden',
    position: 'relative',
    ...tokens.elevation.controlPrimary,
  },
  secondary: {
    minHeight: tokens.size.buttonLg,
    paddingHorizontal: tokens.space.xl,
    paddingVertical: tokens.space.md + 1,
    borderRadius: tokens.radius.md,
    borderWidth: tokens.border.thin,
    borderColor: tokens.colors.borderControl,
    backgroundColor: tokens.colors.surface,
    color: tokens.colors.text,
    fontFamily: tokens.font.display,
    fontWeight: tokens.weight.semibold,
    ...tokens.type.label,
    textAlign: 'center',
    overflow: 'hidden',
    position: 'relative',
    ...tokens.elevation.control,
  },
  textLink: {
    alignSelf: 'flex-start',
    minHeight: tokens.size.controlMd,
    paddingVertical: tokens.space.md,
    fontFamily: tokens.font.sans,
    fontWeight: tokens.weight.semibold,
    color: tokens.colors.accent,
    ...tokens.type.label,
  },
  others: { gap: tokens.space.md, marginTop: tokens.space.lg },
  otherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    minHeight: tokens.size.controlMd,
    paddingVertical: tokens.space.md,
    paddingHorizontal: tokens.space.xs,
    borderTopWidth: tokens.border.thin,
    borderTopColor: tokens.colors.border,
    ...tokens.motion.transitionWeb,
  },
  otherRowHover: { backgroundColor: tokens.colors.surfaceAlt },
  otherText: { flex: 1, gap: 2 },
  otherTitle: { fontFamily: tokens.font.display, color: tokens.colors.text, ...tokens.type.body, fontWeight: tokens.weight.medium },
  otherLead: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, ...tokens.type.caption },
});
