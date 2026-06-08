import { useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { Button } from './Button';
import { Card } from './Card';
import { Screen } from './Screen';
import { tokens } from './tokens';

type PlaceholderScreenProps = {
  title: string;
  description: string;
};

export function PlaceholderScreen({ title, description }: PlaceholderScreenProps) {
  const router = useRouter();
  return (
    <Screen maxWidth={560} center>
      <Card>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        <Button label="Retour à l'accueil" variant="secondary" onPress={() => router.push('/')} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.h1.fontSize,
    lineHeight: tokens.type.h1.lineHeight,
    letterSpacing: tokens.type.h1.letterSpacing,
    fontWeight: tokens.weight.bold,
    marginBottom: tokens.space.md,
  },
  description: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    marginBottom: tokens.space.xl,
  },
});
