/**
 * Page « Qui sommes-nous » (audit landing 2026-06) — contenu statique public.
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button } from '@/ui/Button';
import { LandingHeader } from '@/ui/LandingHeader';
import { Icon, type IconName } from '@/ui/icons';
import { Reveal } from '@/ui/Reveal';
import { tokens } from '@/ui/tokens';

const VALUES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'bookOpen',
    title: 'Accessibilité',
    text: "Une information médicale claire, en français, compréhensible sans bagage scientifique — et des sources toujours consultables gratuitement.",
  },
  {
    icon: 'sparkles',
    title: 'Innovation',
    text: "Une IA de dernière génération au service de l'information en santé : réponses sourcées, outils pour étudiants et professionnels.",
  },
  {
    icon: 'shield',
    title: 'Fiabilité',
    text: 'Des réponses appuyées sur les référentiels français et européens : HAS, ANSM, sociétés savantes, littérature scientifique.',
  },
  {
    icon: 'refresh',
    title: 'Amélioration continue',
    text: 'Modèles, prompts et contenus mis à jour en continu, avec une exigence : jamais un avis médical individuel, toujours de l\'information générale.',
  },
];

export default function AboutScreen() {
  const router = useRouter();
  return (
    <View style={styles.screen}>
      <LandingHeader />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.inner}>
          <Reveal>
            <Text style={styles.eyebrow}>Qui sommes-nous</Text>
            <Text style={styles.title}>L'information santé, sans détour.</Text>
          </Reveal>
          <Reveal delay={tokens.motion.revealStagger}>
            <Text style={styles.lead}>
              MedInfo AI est né d'un constat simple : trouver une information de santé fiable,
              à jour et compréhensible est encore trop difficile. Entre les forums approximatifs
              et les publications scientifiques inaccessibles, il manquait un intermédiaire de
              confiance.
            </Text>
            <Text style={styles.paragraph}>
              Notre réponse : une intelligence artificielle qui s'appuie exclusivement sur la
              littérature médicale française et européenne — recommandations HAS, ANSM, sociétés
              savantes, études publiées — et qui cite ses sources à chaque réponse. Trois
              assistants spécialisés accompagnent chacun à son niveau : le grand public, les
              étudiants en santé et les professionnels.
            </Text>
            <Text style={styles.paragraph}>
              MedInfo AI ne remplace ni votre médecin ni votre pharmacien : nous fournissons de
              l'information générale, jamais un avis médical individuel. En cas d'urgence,
              composez le 15 (SAMU) ou le 112.
            </Text>
          </Reveal>

          <Reveal delay={tokens.motion.revealStagger * 2} style={styles.valuesPanel}>
            <Text style={styles.valuesTitle}>Nos engagements</Text>
            {VALUES.map((v, i) => (
              <View key={v.title} style={[styles.valueRow, i > 0 && styles.valueRowDivided]}>
                <View style={styles.valueIcon}>
                  <Icon name={v.icon} size={20} color={tokens.colors.accent} />
                </View>
                <View style={styles.valueTextBlock}>
                  <Text style={styles.valueTitle}>{v.title}</Text>
                  <Text style={styles.valueText}>{v.text}</Text>
                </View>
              </View>
            ))}
          </Reveal>

          <Reveal delay={tokens.motion.revealStagger * 3} style={styles.ctaRow}>
            <Button
              label="Essayer le chat"
              fullWidth={false}
              onPress={() => router.push('/(chat)/chat')}
            />
            <Button
              label="Nous contacter"
              variant="secondary"
              fullWidth={false}
              onPress={() => router.push('/(marketing)/contact' as never)}
            />
          </Reveal>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.colors.background },
  scroll: { flex: 1 },
  content: { flexGrow: 1, alignItems: 'center', paddingBottom: tokens.space['3xl'] },
  inner: {
    width: '100%',
    maxWidth: 720,
    paddingHorizontal: tokens.space.xl,
    paddingTop: tokens.space['2xl'],
    gap: tokens.space.lg,
  },
  eyebrow: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentVivid,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
    letterSpacing: tokens.tracking.capsWide,
    textTransform: 'uppercase',
    marginBottom: tokens.space.sm,
  },
  title: {
    fontFamily: tokens.font.serif,
    color: tokens.colors.text,
    fontSize: tokens.type.display.fontSize,
    lineHeight: tokens.type.display.lineHeight,
    letterSpacing: tokens.type.display.letterSpacing,
    fontWeight: tokens.weight.semibold,
  },
  lead: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.bodyLg.fontSize,
    lineHeight: tokens.type.bodyLg.lineHeight,
  },
  paragraph: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    marginTop: tokens.space.md,
  },
  valuesPanel: {
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: tokens.space.xl,
    marginTop: tokens.space.md,
    ...tokens.elevation.sm,
  },
  valuesTitle: {
    fontFamily: tokens.font.serif,
    color: tokens.colors.text,
    fontSize: tokens.type.h2.fontSize,
    lineHeight: tokens.type.h2.lineHeight,
    letterSpacing: tokens.type.h2.letterSpacing,
    fontWeight: tokens.weight.semibold,
    marginBottom: tokens.space.sm,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.space.lg,
    paddingVertical: tokens.space.lg,
  },
  valueRowDivided: { borderTopWidth: 1, borderTopColor: tokens.colors.border },
  valueIcon: {
    width: 36,
    height: 36,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueTextBlock: { flex: 1, gap: 2 },
  valueTitle: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    letterSpacing: tokens.type.h3.letterSpacing,
    fontWeight: tokens.weight.bold,
  },
  valueText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.label.fontSize,
    lineHeight: tokens.type.label.lineHeight,
  },
  ctaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.md, marginTop: tokens.space.sm },
});
