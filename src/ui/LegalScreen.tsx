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
    padding: 24,
    backgroundColor: tokens.colors.background,
  },
  card: {
    width: '100%',
    maxWidth: 760,
    borderRadius: 28,
    padding: 28,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  eyebrow: {
    color: tokens.colors.accent,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  title: {
    color: tokens.colors.text,
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
  },
  updated: {
    color: tokens.colors.textMuted,
    fontSize: 13,
    marginBottom: 16,
  },
  intro: {
    color: tokens.colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
  },
  section: {
    marginTop: 24,
  },
  heading: {
    color: tokens.colors.text,
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 10,
  },
  paragraph: {
    color: tokens.colors.textMuted,
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 10,
  },
  footer: {
    marginTop: 32,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    paddingTop: 20,
  },
  link: {
    color: tokens.colors.accent,
    fontSize: 15,
    fontWeight: '800',
  },
});
