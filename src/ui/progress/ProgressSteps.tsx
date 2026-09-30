/**
 * Carte de chargement « proactive » des fonctionnalités IA (2026-09) : titre de la tâche,
 * étapes réelles (franchies ✓ / en cours / à venir), barre de progression qui ne se remplit
 * jamais tant que la réponse n'est pas arrivée, temps écoulé, puis message de patience si
 * l'attente s'allonge. Modèle PUR et raisons de l'affichage : ./stagedProgress.ts.
 *
 * Le chrono démarre au MONTAGE : afficher la carte seulement pendant l'attente
 * (`{loading ? <ProgressSteps plan="qcm" /> : null}`).
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/ui/icons';
import {
  PROGRESS_PLANS,
  SLOW_MESSAGE,
  activeStepIndex,
  formatElapsed,
  isSlow,
  progressFraction,
  type ProgressPlanKey,
} from '@/ui/progress/stagedProgress';
import { tokens } from '@/ui/tokens';
import { useReducedMotion } from '@/ui/useReducedMotion';

const TICK_MS = 500;

export function ProgressSteps({ plan: planKey, compact = false }: { plan: ProgressPlanKey; compact?: boolean }) {
  const plan = PROGRESS_PLANS[planKey];
  const reducedMotion = useReducedMotion();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - start), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const active = activeStepIndex(plan.steps, elapsed);
  const fraction = progressFraction(plan, elapsed);
  const current = plan.steps[active]?.label ?? '';

  return (
    <View
      style={[styles.card, compact && styles.cardCompact]}
      accessibilityRole="progressbar"
      aria-busy
      aria-label={`${plan.title} : ${current}`}
    >
      <View style={styles.header}>
        <ActivityIndicator size="small" color={tokens.colors.accent} />
        <Text style={styles.title}>{plan.title}</Text>
        <Text style={styles.elapsed}>{formatElapsed(elapsed)}</Text>
      </View>

      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${Math.round(fraction * 1000) / 10}%` },
            !reducedMotion && styles.fillAnimated,
          ]}
        />
      </View>

      <View style={styles.steps}>
        {plan.steps.map((step, i) => {
          const done = i < active;
          const isActive = i === active;
          if (compact && !isActive && !done) return null;
          return (
            <View key={step.label} style={styles.step}>
              <View style={[styles.bullet, done && styles.bulletDone, isActive && styles.bulletActive]}>
                {done ? <Icon name="check" size={11} color={tokens.colors.onAccent} /> : null}
              </View>
              <Text
                style={[styles.stepText, done && styles.stepTextDone, isActive && styles.stepTextActive]}
                // Seule l'étape en cours est annoncée aux lecteurs d'écran.
                {...(isActive ? { accessibilityLiveRegion: 'polite' as const, 'aria-live': 'polite' as const } : {})}
              >
                {step.label}
                {isActive ? '…' : ''}
              </Text>
            </View>
          );
        })}
      </View>

      {isSlow(plan, elapsed) ? <Text style={styles.slow}>{SLOW_MESSAGE}</Text> : null}
    </View>
  );
}

const BULLET = 16;

const styles = StyleSheet.create({
  card: {
    gap: tokens.space.sm,
    padding: tokens.space.md,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    alignSelf: 'stretch',
  },
  cardCompact: { padding: tokens.space.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  title: {
    flex: 1,
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    lineHeight: tokens.type.label.lineHeight,
    fontWeight: tokens.weight.semibold,
  },
  elapsed: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.micro.fontSize,
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: tokens.colors.surfaceSunken,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 2, backgroundColor: tokens.colors.accent },
  // Transition web seulement (ignorée en natif) : la barre glisse entre deux ticks.
  fillAnimated: { transitionProperty: 'width', transitionDuration: `${TICK_MS}ms`, transitionTimingFunction: 'linear' } as object,
  steps: { gap: 6 },
  step: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  bullet: {
    width: BULLET,
    height: BULLET,
    borderRadius: BULLET / 2,
    borderWidth: 1.5,
    borderColor: tokens.colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletDone: { backgroundColor: tokens.colors.accent, borderColor: tokens.colors.accent },
  bulletActive: { borderColor: tokens.colors.accent, borderWidth: 4 },
  stepText: {
    flex: 1,
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    lineHeight: 18,
  },
  stepTextDone: { color: tokens.colors.textSubtle },
  stepTextActive: { color: tokens.colors.text, fontWeight: tokens.weight.semibold },
  slow: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    lineHeight: 18,
    fontStyle: 'italic',
  },
});
