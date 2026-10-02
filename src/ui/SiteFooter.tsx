/**
 * Footer public (refonte SEO 2026-07) — maillage interne des pages marketing.
 *
 * Quatre colonnes de liens (Chatbots / Outils / Ressources / Légal) rendues avec
 * expo-router <Link> : sur web, ce sont de vraies balises <a> crawlables — c'est
 * ce maillage que lisent les moteurs, pas les menus JS. Le footer rappelle aussi
 * la limite d'usage (information générale, urgences 15/112).
 *
 * Le masquage UI n'est jamais l'unique barrière : les liens vers les outils
 * renvoient vers des écrans protégés (RoleGate + autorisation serveur).
 */
import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Logo } from '@/ui/Logo';
import { tokens } from '@/ui/tokens';

type FooterLink = { label: string; href: string };

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: 'Chatbots IA',
    links: [
      { label: 'Chat grand public', href: '/(chat)/chat?bot=public' },
      { label: 'Chat étudiant en santé', href: '/(chat)/chat?bot=student' },
      { label: 'Chat professionnel de santé', href: '/(chat)/chat?bot=professional' },
    ],
  },
  {
    title: 'Outils',
    links: [
      { label: 'Analyse de document médical', href: '/(chat)/document' },
      { label: 'Simulation ECOS', href: '/(chat)/ecos' },
      { label: 'Planning de révisions', href: '/(chat)/revision' },
      { label: 'Analyse des partiels', href: '/(chat)/partiel' },
      { label: 'Générateur de présentations', href: '/(chat)/presentation' },
      { label: 'Créateur de CV médical', href: '/(chat)/cv-builder' },
      { label: 'Compte rendu de consultation', href: '/(chat)/audio' },
    ],
  },
  {
    title: 'Ressources',
    links: [
      { label: 'Blog santé', href: '/(marketing)/blog' },
      { label: 'À propos', href: '/(marketing)/a-propos' },
      { label: 'Contact', href: '/(marketing)/contact' },
      { label: 'Tarifs', href: '/(billing)/pricing' },
    ],
  },
  {
    title: 'Légal',
    links: [
      { label: 'Mentions légales', href: '/(legal)/mentions-legales' },
      { label: 'Conditions d’utilisation', href: '/(legal)/cgu' },
      { label: 'Confidentialité (RGPD)', href: '/(legal)/confidentialite' },
      { label: 'Informations légales', href: '/(legal)/legal' },
    ],
  },
];

export function SiteFooter() {
  return (
    <View style={styles.footer}>
      <View style={styles.inner}>
        <View style={styles.brandBlock}>
          <Logo size="sm" />
          <Text style={styles.tagline}>
            L’information médicale générale, pour le grand public, les étudiants et
            les professionnels de santé.
          </Text>
        </View>

        <View style={styles.columns}>
          {COLUMNS.map((col) => (
            <View key={col.title} style={styles.column}>
              <Text style={styles.columnTitle}>{col.title}</Text>
              {col.links.map((link) => (
                <Link key={link.href + link.label} href={link.href as never} style={styles.link}>
                  {link.label}
                </Link>
              ))}
            </View>
          ))}
        </View>

        <View style={styles.bottom}>
          <Text style={styles.disclaimer}>
            MedInfo AI fournit de l’information médicale générale, jamais un avis médical
            individuel. En cas d’urgence, composez le 15 (SAMU) ou le 112.
          </Text>
          <Text style={styles.copyright}>© {new Date().getFullYear()} MedInfo AI</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    alignSelf: 'stretch',
    // Colle le footer en bas quand la page est plus courte que l'écran
    // (consomme l'espace libre du contentContainer flexGrow:1).
    marginTop: 'auto',
    backgroundColor: tokens.colors.surfaceAlt,
    borderTopWidth: tokens.border.accent,
    borderTopColor: tokens.colors.editorial.highlight,
    paddingHorizontal: tokens.space.xl,
    paddingTop: tokens.space['2xl'],
    paddingBottom: tokens.space.xl,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  inner: { width: '100%', maxWidth: tokens.layout.page, gap: tokens.space.xl },
  brandBlock: { gap: tokens.space.sm },
  tagline: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.label.fontSize,
    lineHeight: tokens.type.label.lineHeight,
    maxWidth: tokens.layout.form,
  },
  columns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space.xl,
  },
  column: { flexGrow: 1, flexBasis: 180, gap: tokens.space.sm },
  columnTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.bold,
    textTransform: 'none',
    marginBottom: tokens.space.xs,
  },
  link: {
    minHeight: tokens.size.controlMd,
    paddingVertical: tokens.space.md,
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.label.fontSize,
    lineHeight: tokens.type.label.lineHeight,
  },
  bottom: {
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    paddingTop: tokens.space.lg,
    gap: tokens.space.sm,
  },
  disclaimer: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    lineHeight: tokens.type.caption.lineHeight,
  },
  copyright: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
  },
});
