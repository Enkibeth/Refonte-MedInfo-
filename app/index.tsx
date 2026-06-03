import { Link } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { INTENDED_PURPOSE, getAiDisclosure } from '@/compliance/disclosures';
import { tokens } from '@/ui/tokens';

export default function HomeScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>MedInfo AI v4</Text>
        <Text style={styles.title}>Socle Expo prêt.</Text>
        <Text style={styles.body}>{INTENDED_PURPOSE}</Text>
        <Text style={styles.notice}>{getAiDisclosure()}</Text>

        <View style={styles.links}>
          <Link href="/(chat)/chat" style={styles.link}>Chat placeholder</Link>
          <Link href="/(auth)/sign-in" style={styles.link}>Auth placeholder</Link>
          <Link href="/(account)/account" style={styles.link}>Compte placeholder</Link>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 36,
    fontWeight: '800',
    marginBottom: 16,
  },
  body: {
    color: tokens.colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
  },
  notice: {
    marginTop: 20,
    color: tokens.colors.warningText,
    backgroundColor: tokens.colors.warningBackground,
    borderRadius: 16,
    padding: 16,
    lineHeight: 22,
  },
  links: {
    marginTop: 24,
    gap: 12,
  },
  link: {
    color: tokens.colors.accent,
    fontSize: 16,
    fontWeight: '700',
  },
});
