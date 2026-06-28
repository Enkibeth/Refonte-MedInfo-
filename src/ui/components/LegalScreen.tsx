import { Link } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { LegalDocument } from '@/compliance/legal';
import { legalLinks } from '@/compliance/legal';
import { tokens } from '@/ui/theme/tokens';

/**
 * Rendu générique d'un document légal (mentions légales, confidentialité, CGU/CGV).
 * Le contenu vit dans `src/compliance/legal.ts` (source unique versionnée) ; ce composant
 * ne fait que le présenter, sans aucun texte médical en dur (gate `compliance-grep`).
 */
export function LegalScreen({ document }: { document: LegalDocument }) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Informations légales</Text>
        <Text style={styles.title}>{document.title}</Text>
        <Text style={styles.updated}>Dernière mise à jour : {document.updatedAt}</Text>
        <Text style={styles.intro}>{document.intro}</Text>

        {document.sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.heading}>{section.heading}</Text>
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
    padding: tokens.space.xl,
    backgroundColor: tokens.colors.background,
  },
  card: {
    width: '100%',
    maxWidth: 760,
    borderRadius: tokens.radius.xl,
    padding: tokens.space.xl,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    ...tokens.elevation.sm,
  },
  eyebrow: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: tokens.tracking.capsWide,
    marginBottom: tokens.space.md,
  },
  title: {
    fontFamily: tokens.font.serif,
    color: tokens.colors.text,
    fontSize: tokens.type.h1.fontSize,
    lineHeight: tokens.type.h1.lineHeight,
    letterSpacing: tokens.type.h1.letterSpacing,
    fontWeight: tokens.weight.semibold,
    marginBottom: tokens.space.sm,
  },
  updated: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    marginBottom: tokens.space.lg,
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
    fontSize: tokens.type.h3.fontSize,
    letterSpacing: tokens.type.h3.letterSpacing,
    fontWeight: tokens.weight.semibold,
    marginBottom: tokens.space.sm,
  },
  paragraph: {
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
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentVivid,
    fontSize: tokens.type.body.fontSize,
    fontWeight: tokens.weight.semibold,
  },
});
