import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { INTENDED_PURPOSE, getAiDisclosure } from '@/compliance/disclosures';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Logo } from '@/ui/Logo';
import { Screen } from '@/ui/Screen';
import { tokens } from '@/ui/tokens';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <Screen maxWidth={680} center>
      <View style={styles.brandRow}>
        <Logo size="lg" />
      </View>

      <Text style={styles.headline}>Information médicale claire, sourcée, sans détour.</Text>
      <Text style={styles.lede}>{INTENDED_PURPOSE}</Text>

      <View style={styles.actions}>
        <Button label="Ouvrir le chat" onPress={() => router.push('/(chat)/chat')} />
        <Button label="Se connecter" variant="secondary" onPress={() => router.push('/(auth)/sign-in')} />
        <Button label="Mon compte" variant="ghost" onPress={() => router.push('/(account)/account')} />
      </View>

      <Card style={styles.notice} padded={false}>
        <View style={styles.noticeAccent} />
        <Text style={styles.noticeText}>{getAiDisclosure()}</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandRow: { marginBottom: tokens.space['2xl'] },
  headline: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.display.fontSize,
    lineHeight: tokens.type.display.lineHeight,
    letterSpacing: tokens.type.display.letterSpacing,
    fontWeight: tokens.weight.bold,
    marginBottom: tokens.space.lg,
  },
  lede: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.bodyLg.fontSize,
    lineHeight: tokens.type.bodyLg.lineHeight,
  },
  actions: { marginTop: tokens.space['2xl'], gap: tokens.space.md, maxWidth: 320 },
  notice: {
    marginTop: tokens.space['2xl'],
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: tokens.colors.accentSurface,
    borderColor: tokens.colors.accentSurfaceStrong,
  },
  noticeAccent: { width: 4, backgroundColor: tokens.colors.accent },
  noticeText: {
    flex: 1,
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.label.fontSize,
    lineHeight: tokens.type.label.lineHeight,
    padding: tokens.space.lg,
  },
});
