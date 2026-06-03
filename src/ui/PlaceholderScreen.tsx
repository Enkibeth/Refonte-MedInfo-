import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { tokens } from './tokens';

type PlaceholderScreenProps = {
  title: string;
  description: string;
};

export function PlaceholderScreen({ title, description }: PlaceholderScreenProps) {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        <Link href="/" style={styles.link}>Retour accueil</Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: tokens.colors.background,
  },
  card: {
    width: '100%',
    maxWidth: 640,
    borderRadius: 24,
    padding: 24,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  title: {
    color: tokens.colors.text,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 12,
  },
  description: {
    color: tokens.colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
  },
  link: {
    color: tokens.colors.accent,
    fontWeight: '700',
  },
});
