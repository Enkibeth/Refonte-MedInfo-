import { useRouter } from 'expo-router';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { INTENDED_PURPOSE, getAiDisclosure } from '@/compliance/disclosures';
import { Button } from '@/ui/Button';
import { Logo } from '@/ui/Logo';
import { tokens } from '@/ui/tokens';

const TRUST_POINTS = [
  { title: 'Sources officielles', text: 'Réponses appuyées sur HAS, ANSM, VIDAL, Thériaque, PubMed.' },
  { title: 'Transparence', text: 'Chaque échange rappelle qu’il s’agit d’une IA et reste vérifiable.' },
  { title: 'Références gratuites', text: 'Les sources restent accessibles à tous, abonné ou non.' },
];

export default function HomeScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {/* Hero plein écran, fort contraste (petrol profond / blanc) */}
      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <View style={styles.heroInner}>
          <Logo size="lg" tone="light" />
          <Text style={styles.eyebrow}>Information médicale de référence</Text>
          <Text style={styles.headline}>
            Des réponses santé claires,{'\n'}sourcées et sans détour.
          </Text>
          <Text style={styles.subhead}>
            Posez vos questions médicales et pharmacologiques. MedInfo AI répond à partir de la
            littérature française et européenne — information générale, jamais un avis individuel.
          </Text>

          <View style={styles.actions}>
            <Button label="Ouvrir le chat" variant="inverse" onPress={() => router.push('/(chat)/chat')} />
            <Button label="Se connecter" variant="outlineLight" onPress={() => router.push('/(auth)/sign-in')} />
          </View>
        </View>
      </View>

      {/* Bloc confiance sur fond clair */}
      <View style={styles.section}>
        <View style={styles.trustGrid}>
          {TRUST_POINTS.map((p) => (
            <View key={p.title} style={styles.trustCard}>
              <View style={styles.trustDot} />
              <Text style={styles.trustTitle}>{p.title}</Text>
              <Text style={styles.trustText}>{p.text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.purpose}>
          <Text style={styles.purposeLabel}>Finalité prévue</Text>
          <Text style={styles.purposeText}>{INTENDED_PURPOSE}</Text>
        </View>

        {/* Illustration de marque (transitoire — 05_DESIGN §6 : imagerie IA non définitive). */}
        <Image
          source={require('../assets/brand/legacy-illustration.png')}
          style={styles.illustration}
          resizeMode="contain"
          accessibilityLabel="Illustration MedInfo AI : équipe soignante avec un chat et un chien — Soins · Compassion · Science"
        />

        <View style={styles.notice}>
          <View style={styles.noticeAccent} />
          <Text style={styles.noticeText}>{getAiDisclosure()}</Text>
        </View>

        <View style={styles.footerActions}>
          <Button
            label="Accéder à mon compte"
            variant="ghost"
            fullWidth={false}
            onPress={() => router.push('/(account)/account')}
          />
          <Button
            label="Informations légales"
            variant="ghost"
            fullWidth={false}
            onPress={() => router.push('/(legal)/legal')}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.colors.background },
  content: { flexGrow: 1 },

  // ── Hero ──
  hero: {
    backgroundColor: tokens.colors.accentDarker,
    overflow: 'hidden',
    paddingHorizontal: tokens.space.xl,
    paddingTop: tokens.space['3xl'],
    paddingBottom: tokens.space['3xl'],
    alignItems: 'center',
  },
  heroGlow: {
    position: 'absolute',
    top: -160,
    right: -120,
    width: 360,
    height: 360,
    borderRadius: 999,
    backgroundColor: tokens.colors.accent,
    opacity: 0.35,
  },
  heroInner: { width: '100%', maxWidth: 720, gap: tokens.space.md },
  eyebrow: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentSurfaceStrong,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: tokens.space.xl,
  },
  headline: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontSize: tokens.type.display.fontSize,
    lineHeight: tokens.type.display.lineHeight,
    letterSpacing: tokens.type.display.letterSpacing,
    fontWeight: tokens.weight.bold,
  },
  subhead: {
    fontFamily: tokens.font.sans,
    color: 'rgba(255,255,255,0.82)',
    fontSize: tokens.type.bodyLg.fontSize,
    lineHeight: tokens.type.bodyLg.lineHeight,
    maxWidth: 600,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space.md,
    marginTop: tokens.space.lg,
    maxWidth: 420,
  },

  // ── Section claire ──
  section: {
    paddingHorizontal: tokens.space.xl,
    paddingTop: tokens.space['2xl'],
    paddingBottom: tokens.space['3xl'],
    alignItems: 'center',
  },
  trustGrid: {
    width: '100%',
    maxWidth: 720,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space.md,
  },
  trustCard: {
    flexGrow: 1,
    flexBasis: 200,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: tokens.space.lg,
    gap: tokens.space.xs,
    ...tokens.elevation.sm,
  },
  trustDot: {
    width: 10,
    height: 10,
    borderRadius: 3,
    backgroundColor: tokens.colors.accent,
    marginBottom: tokens.space.xs,
  },
  trustTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    letterSpacing: tokens.type.h3.letterSpacing,
    fontWeight: tokens.weight.bold,
  },
  trustText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.label.fontSize,
    lineHeight: tokens.type.label.lineHeight,
  },
  illustration: {
    width: '100%',
    maxWidth: 720,
    height: 280,
    alignSelf: 'center',
    borderRadius: tokens.radius.lg,
    marginTop: tokens.space.xl,
  },
  purpose: {
    width: '100%',
    maxWidth: 720,
    marginTop: tokens.space.xl,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.accentSurface,
    borderWidth: 1,
    borderColor: tokens.colors.accentSurfaceStrong,
    padding: tokens.space.lg,
    gap: tokens.space.xs,
  },
  purposeLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  purposeText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.label.fontSize,
    lineHeight: 21,
  },
  notice: {
    width: '100%',
    maxWidth: 720,
    flexDirection: 'row',
    marginTop: tokens.space.md,
    borderRadius: tokens.radius.md,
    overflow: 'hidden',
    backgroundColor: tokens.colors.warningBackground,
  },
  noticeAccent: { width: 4, backgroundColor: tokens.colors.warningText },
  noticeText: {
    flex: 1,
    fontFamily: tokens.font.sans,
    color: tokens.colors.warningText,
    fontSize: tokens.type.caption.fontSize,
    lineHeight: 19,
    padding: tokens.space.lg,
  },
  footerActions: {
    marginTop: tokens.space.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space.sm,
  },
});
