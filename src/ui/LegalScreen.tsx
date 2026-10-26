import { Link } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { LegalDocument } from '@/compliance/legal';
import { legalLinks } from '@/compliance/legal';
import { NightBand } from '@/ui/NightBand';
import { SeoHead } from '@/ui/SeoHead';
import { tokens } from '@/ui/tokens';

/**
 * Rendu générique d'un document légal (mentions légales, confidentialité, CGU/CGV).
 * Le contenu vit dans `src/compliance/legal.ts` (source unique versionnée) ; ce composant
 * ne fait que le présenter, sans aucun texte médical en dur (gate `compliance-grep`).
 */
export function LegalScreen({ document }: { document: LegalDocument }) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <SeoHead
        title={document.title}
        description={document.intro.length > 160 ? `${document.intro.slice(0, 157)}…` : document.intro}
        path={`/${document.slug}`}
      />
      {/* Bandeau « Moniteur » (ADR-0047) : repère, titre de niveau 1 et date de mise à jour. */}
      <NightBand maxWidth={tokens.layout.reading} kicker="Informations légales" title={document.title}>
        <Text style={styles.updated}>Dernière mise à jour{'\u00a0'}: {document.updatedAt}</Text>
      </NightBand>
      <View style={styles.card}>
        <Text style={styles.intro}>{document.intro}</Text>

        {document.sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text role="heading" aria-level={2} style={styles.heading}>{section.heading}</Text>
            {section.body.map((paragraph, index) => (
              <Text key={index} style={styles.paragraph}>
                {paragraph}
              </Text>
            ))}
          </View>
        ))}

        <View style={styles.footer}>
          {legalLinks
            .filter((link) => link.slug !== document.slug)
            .map((link) => (
              <Link key={link.slug} href={`/(legal)/${link.slug}`} style={styles.link}>
                {link.title}
              </Link>
            ))}
          <Link href="/" style={styles.link}>
            Retour à l’accueil
          </Link>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    paddingBottom: tokens.space.xl,
    backgroundColor: tokens.colors.background,
  },
  card: {
    width: '100%',
    maxWidth: tokens.layout.reading,
    borderRadius: 0,
    padding: tokens.space.xl,
    backgroundColor: tokens.colors.surface,
  },
  updated: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.night.muted,
    fontSize: tokens.type.caption.fontSize,
  },
  intro: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.bodyLg.fontSize,
    lineHeight: tokens.type.bodyLg.lineHeight,
  },
  section: {
    marginTop: tokens.space.xl,
  },
  heading: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    ...tokens.type.h3,
    fontWeight: tokens.weight.semibold,
    marginBottom: tokens.space.sm,
  },
  paragraph: {
    maxWidth: tokens.layout.measure, // ≈ 75 caractères par ligne (83 à 95 auparavant)
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    marginBottom: tokens.space.sm,
  },
  footer: {
    marginTop: tokens.space['2xl'],
    gap: tokens.space.md,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    paddingTop: tokens.space.lg,
  },
  link: {
    minHeight: tokens.size.controlMd,
    lineHeight: tokens.type.label.lineHeight,
    paddingVertical: tokens.space.md,
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep, // texte : accentVivid n’atteint pas 4,5:1 sur le fond ivoire
    fontSize: tokens.type.body.fontSize,
    fontWeight: tokens.weight.semibold,
  },
});
