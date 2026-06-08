import { Link } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { LegalDocument } from '@/compliance/legal';
import { legalLinks } from '@/compliance/legal';
import { tokens } from '@/ui/tokens';

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
    borderRadius: tokens.radius.none,
    padding: tokens.space.xl,
    backgroundColor: tokens.colors.surfacePure,
    borderWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
  },
  eyebrow: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.accent,
    fontSize: tokens.type.mono.fontSize,
    letterSpacing: tokens.type.mono.letterSpacing,
    fontWeight: tokens.weight.bold,
    textTransform: 'uppercase',
    marginBottom: tokens.space.md,
  },
  title: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.display.fontSize,
    lineHeight: tokens.type.display.lineHeight,
    letterSpacing: tokens.type.display.letterSpacing,
    fontWeight: tokens.weight.bold,
    marginBottom: tokens.space.sm,
  },
  updated: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.monoSm.fontSize,
    letterSpacing: tokens.type.monoSm.letterSpacing,
    textTransform: 'uppercase',
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
    lineHeight: tokens.type.h3.lineHeight,
    letterSpacing: tokens.type.h3.letterSpacing,
    fontWeight: tokens.weight.bold,
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
    borderTopWidth: tokens.border.hairline,
    borderTopColor: tokens.colors.border,
    paddingTop: tokens.space.lg,
  },
  link: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accent,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
