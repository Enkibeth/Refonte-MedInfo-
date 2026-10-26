import { Platform, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/ui/icons';
import { tokens } from '@/ui/tokens';

import { HERO_COPY, HERO_READINGS } from './copy';
import { lx } from './lx';

const TINTS = {
  public: tokens.colors.personas.public,
  student: tokens.colors.personas.student,
  professional: tokens.colors.personas.pro,
};
const ICONS = { public: 'users', student: 'bookOpen', professional: 'stethoscope' } as const;

/**
 * Carte « trois lectures » du hero (ADR-0047) : la même question, et la FORME de la réponse
 * pour chacun des trois assistants, qui défile toutes les 4 s (web, CSS seul). Les trois
 * segments du haut montrent l'avancement du cycle. Figée par « Figer » ou par
 * prefers-reduced-motion : la lecture grand public reste affichée.
 *
 * Illustration (`role="img"`) : décrite d'un trait aux lecteurs d'écran.
 */
export function ReadingCard() {
  return (
    <View
      {...lx('lx-card')}
      accessibilityRole="image"
      accessibilityLabel="Exemple d’affichage : la même question sur l’hypertension, expliquée pour le grand public, pour les étudiants et pour les professionnels."
      style={styles.card}
    >
      <View style={styles.top}>
        <Text style={styles.label}>{HERO_COPY.cardLabel}</Text>
        <View style={styles.segments}>
          {HERO_READINGS.map((reading, i) => (
            <View key={reading.id} style={styles.segment}>
              <View {...lx(['lx-seg', `lx-seg-${i + 1}`])} style={[styles.segmentFill, { backgroundColor: TINTS[reading.id].accent }, i > 0 && styles.segmentEmpty]} />
            </View>
          ))}
        </View>
      </View>
      <View style={styles.question}>
        <Text style={styles.questionText}>{HERO_COPY.cardQuestion}</Text>
      </View>
      <View {...lx('lx-readings')} style={styles.readings}>
        {HERO_READINGS.map((reading, i) => {
          const tint = TINTS[reading.id];
          // Natif : la première lecture seule (pas de cycle).
          if (Platform.OS !== 'web' && i > 0) return null;
          return (
            <View key={reading.id} {...lx(['lx-read', `lx-read-${i + 1}`])} style={styles.reading}>
              <View style={[styles.pill, { backgroundColor: tint.soft }]}>
                <Icon name={ICONS[reading.id]} size={14} color={tint.accent} />
                <Text style={[styles.pillText, { color: tint.accent }]}>{reading.label}</Text>
              </View>
              <Text style={styles.text}>{reading.text}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.xl + 4,
    padding: tokens.space.lg,
    gap: tokens.space.md,
    ...Platform.select({
      web: { boxShadow: '0 2px 4px rgba(12,20,56,0.18), 0 36px 64px -24px rgba(12,20,56,0.55)' },
      default: {},
    }),
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: tokens.space.md },
  label: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, ...tokens.type.micro, fontWeight: tokens.weight.semibold, letterSpacing: tokens.tracking.caps, textTransform: 'uppercase' },
  segments: { flexDirection: 'row', gap: 4, width: 96 },
  segment: { flex: 1, height: 3, borderRadius: 2, backgroundColor: tokens.colors.surfaceSunken, overflow: 'hidden' },
  segmentFill: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, ...Platform.select({ web: { transformOrigin: 'left center' }, default: {} }) },
  segmentEmpty: { opacity: 0 },
  question: {
    alignSelf: 'flex-end',
    maxWidth: '92%',
    backgroundColor: tokens.colors.accentVivid,
    borderRadius: tokens.radius.xl,
    borderBottomRightRadius: tokens.radius.xs,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
  },
  questionText: { fontFamily: tokens.font.sans, color: tokens.colors.onAccent, ...tokens.type.label, fontWeight: tokens.weight.medium },
  readings: { minHeight: 112 },
  reading: { gap: tokens.space.sm },
  pill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: tokens.space.xs + 2, borderRadius: tokens.radius.pill, paddingHorizontal: tokens.space.sm + 2, paddingVertical: 3 },
  pillText: { fontFamily: tokens.font.display, ...tokens.type.caption, fontWeight: tokens.weight.semibold },
  text: { fontFamily: tokens.font.sans, color: tokens.colors.textSubtle, ...tokens.type.label },
});
